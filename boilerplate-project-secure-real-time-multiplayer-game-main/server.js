require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const expect = require('chai');
const socket = require('socket.io');  // enables real-time, bi-directional communication between web clients and servers
const cors = require('cors');
const http = require('http');
const helmet = require('helmet');
const noCache = require('nocache');

const fccTestingRoutes = require('./routes/fcctesting.js');
const runner = require('./test-runner.js'); // run tests by doing npm run test on console

const app = express();
const server = http.createServer(app);
const io = socket(server);

app.use('/public', express.static(process.cwd() + '/public'));
app.use('/assets', express.static(process.cwd() + '/assets'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//For FCC testing purposes and enables user to connect from outside the hosting platform
app.use(cors({origin: '*'})); 

// Info from https://www.npmjs.com/package/helmet/v/6.1.2
app.use(helmet.noSniff());  // Prevent the client from trying to guess / sniff the MIME type.
app.use(helmet.xssFilter());  // Prevent cross-site scripting (XSS) attacks.
app.use(helmet.noCache());  // Nothing from the website is cached in the client. (deprecated but due to unit test requirements, kept in)
app.use(noCache());
app.use(function(req, res, next) {  // The headers say that the site is powered by 'PHP 7.4.3'. (https://github.com/helmetjs/helmet/wiki/How-to-set-a-custom-X%E2%80%93Powered%E2%80%93By-header)
  res.setHeader("x-Powered-By", "PHP 7.4.3");
  next();
});

// Index page (static HTML)
app.route('/')
  .get(function (req, res) {
    res.sendFile(process.cwd() + '/views/index.html');
  }); 

//For FCC testing purposes
fccTestingRoutes(app);
    
// 404 Not Found Middleware
app.use(function(req, res, next) {
  res.status(404)
    .type('text')
    .send('Not Found');
});

const portNum = process.env.PORT || 3000;

/*** Start: Implementation v2 ***/
let playerList = {};
let collectible = {};
const boardElementSize = 540;
let boardEdges;
let activeGame = false;  // by default, inactive game has no collectible or players yet

/***
 * get Edge coordinates based on starting and ending points of a square object
 * Based on: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from
 * Unique merged filtering from: https://stackoverflow.com/questions/20339466/how-to-remove-duplicates-from-a-two-dimensional-array
 */
function getEdgeCoordinates(startPts, endPts) { 
  let northEdge = Array.from({length: (endPts[0] - startPts[0]) + 1 / 1}, (_, i) => [startPts[0] + i, startPts[1]]); // get north coordinates and assign them to a nested array
  let westEdge = Array.from({length: (endPts[1] - startPts[1]) + 1 / 1}, (_, i) => [startPts[0], startPts[1] + i]); // get west coordinates and assign them to a nested array
  let southEdge = Array.from({length: (endPts[0] - startPts[0]) + 1 / 1}, (_, i) => [startPts[0] + i, endPts[1]]); // get south coordinates and assign them to a nested array
  let eastEdge = Array.from({length: (endPts[1] - startPts[1]) + 1 / 1}, (_, i) => [endPts[0], startPts[1] + i]); // get east coordinates and assign them to a nested array

  let mergedEdges = northEdge.concat(westEdge, southEdge, eastEdge);  // combine all edged into one single array ([[199, 306], [200, 308], ...])
  let uniqueEdgeSet = new Set(mergedEdges); // convert to set ({[199, 306], [200, 308], ...})
  const uniqueEdgeArray = [...uniqueEdgeSet]; // remove duplicate values in the single nested array ([[199, 306], [200, 308], ...]])
  return uniqueEdgeArray; // returns nested array that contains all unique edge values
}

/*** 
 * Define the player object with id, coordinates, score, etc.
 */
function setPlayer(playerId, color) {
  // console.log("setting player...");
  let playerStartPts = [Math.ceil(Math.random() * boardElementSize), Math.ceil(Math.random() * boardElementSize)];  // get random x, y values for player starting coordinates
  let playerEndPts = [playerStartPts[0] + 25, playerStartPts[1] + 40];    // assign x, y values for player end coordinates
  let playerCoordinates = getEdgeCoordinates(playerStartPts, playerEndPts);

  let restrictedAreas = boardEdges; // start off with restricted areas on the board
  for (const [key, value] of Object.entries(playerList)) {  // iterate through the properties of all the current players
    if (key !== playerId) { // adds restricted areas of other players other than the one being created
      restrictedAreas = restrictedAreas.concat(value["edgeCoordinates"]); // add edge coordinates of other players to restricted areas list
    }
  }

  let restrictedAreasString = JSON.stringify(restrictedAreas);  // convert boardEdges array to string for easier traversal
  let restrictedArea = playerCoordinates.some((item) => restrictedAreasString.indexOf(JSON.stringify(item)) != -1); // check if player coordinates touch border edges

  while (restrictedArea) {
    playerStartPts = [Math.ceil(Math.random() * boardElementSize), Math.ceil(Math.random() * boardElementSize)];
    playerEndPts = [playerStartPts[0] + 25, playerEndPts[1] + 40];    // assign x, y values for collectible end coordinates
    playerCoordinates = getEdgeCoordinates(playerStartPts, playerEndPts); 
    restrictedArea = playerCoordinates.some((item) => restrictedAreasString.indexOf(JSON.stringify(item)) != -1); // check if player coordinates touch border edges
  }

  playerList[playerId] = {
    "id": playerId,
    "score": 0,
    "rank": 1,
    "nextRank": 100,
    "x": playerStartPts[0],
    "y": playerStartPts[1],
    "edgeCoordinates": playerCoordinates,
    "playerColor": color,
  }
  // console.log(playerList);
  return playerList;
}

/*** 
 * Define the collectible object with id, coordinates, score, etc.
 */
function setCollectible() {
  // console.log("setting collectible...")
  collectible = {};
  let collectibleStartPts = [Math.ceil(Math.random() * boardElementSize), Math.ceil(Math.random() * boardElementSize)];  // get random x, y values for player starting coordinates
  let collectibleEndPts = [collectibleStartPts[0] + 14, collectibleStartPts[1] + 20];    // assign x, y values for player end coordinates
  let collectibleCoordinates = getEdgeCoordinates(collectibleStartPts, collectibleEndPts); 

  let restrictedAreas = boardEdges;
  for (const [key, value] of Object.entries(playerList)) {  // iterate through the properties of all the current players
    restrictedAreas = restrictedAreas.concat(value["edgeCoordinates"]); // add edge coordinates of other players to restricted areas list
  }

  let restrictedAreasString = JSON.stringify(restrictedAreas);  // convert boardEdges array to string for easier traversal
  let restrictedArea = collectibleCoordinates.some((item) => restrictedAreasString.indexOf(JSON.stringify(item)) != -1); // check if player coordinates touch border edges

  while (restrictedArea) {  // redefine new collectible coordinates while new collectible hits restricted areas like players or board edges
    collectibleStartPts = [Math.ceil(Math.random() * boardElementSize), Math.ceil(Math.random() * boardElementSize)];
    collectibleEndPts = [collectibleStartPts[0] + 14, collectibleEndPts[1] + 20];    // assign x, y values for collectible end coordinates
    collectibleCoordinates = getEdgeCoordinates(collectibleStartPts, collectibleEndPts); 
    restrictedArea = collectibleCoordinates.some((item) => restrictedAreasString.indexOf(JSON.stringify(item)) != -1); // check if player coordinates touch border edges
  }

  collectible["id"] = generateCollectibleId();
  collectible["status"] = "active";
  collectible["x"] = collectibleStartPts[0];
  collectible["y"] = collectibleStartPts[1];
  collectible["edgeCoordinates"] = collectibleCoordinates,
  collectible["score"] = Math.floor(Math.random() * 100) + 1;

  return collectible;
}

/*** 
 * Generate an id for the collectible
 */
function generateCollectibleId() {
  const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 16; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      id += characters[randomIndex];
  }
  return Date.now().toString(16) + id;
}

/*** 
 * Checks for collision with edges, other players or collectibles
 */
function checkCollision(id, x, y) {
  let playerStartPts = [x, y];
  let playerEndPts = [x + 25, y + 40];    // assign x, y values for player end coordinates
  let playerCoordinates = getEdgeCoordinates(playerStartPts, playerEndPts); 
  let playerCollisionAreas = [];  // array to store collision areas from other players
  let collisionType = {"board": false, "player": false, "collectible": false};
  
  let boardEdgesString = JSON.stringify(boardEdges);  // convert boardEdges array to string for easier traversal

  const borderViolation = playerCoordinates.some((item) => boardEdgesString.indexOf(JSON.stringify(item)) != -1); // check if player coordinates touch border edges
  collisionType["board"] = borderViolation;

  for (const [key, value] of Object.entries(playerList)) {  // iterate through player areas
    if (key != id) {
      // adds other player areas to restricted
      playerCollisionAreas = playerCollisionAreas.concat(playerList[key]["edgeCoordinates"]);
    }
  }

  let playerCollisionString = JSON.stringify(playerCollisionAreas);  // convert other player coordinates array to string for easier traversal
  const playerViolation = playerCoordinates.some((item) => playerCollisionString.indexOf(JSON.stringify(item)) != -1);   // check if player coordinates touch other player coordinates
  collisionType["player"] = playerViolation;

  let collectibleCollisionString = JSON.stringify(collectible["edgeCoordinates"]);  // convert collible coordinates array to string for easier traversal
  const collectibleViolation = playerCoordinates.some((item) => collectibleCollisionString.indexOf(JSON.stringify(item)) != -1);  // check if player coordinates touch collectible coordinates
  collisionType["collectible"] = collectibleViolation;

  return collisionType;
}

io.on('connection', (socket) => {
  boardEdges = getEdgeCoordinates([0, 0], [540, 540]);  // 

  // socket.on("initializeServer", (callback) => {
  //   callback({
  //     initialized: true,
  //   })
  // });

  socket.on("setCollectible", async (callback) => {
    if (!Object.hasOwn(collectible, "id")) {  // check if collectible exists, if not create it
      let collectibleExists = await setCollectible();
      if (collectibleExists) {
        callback({
          collectibleStatus: true,
          collectibleValue: collectible,
        })
      }
    }
    // callback({
    //   collectibleStatus: true,
    // })
  });
  
  socket.on("getCollectible", (callback) => {
    socket.emit("collectibleToClient", collectible);  // send collectible object to client
    // console.log(collectible);
    callback({
      item: collectible,
    })
  });

  /***
   * Create player based on id and color attributes
   */
  socket.on("generatePlayer", (arg, callback) => {
    let id = arg["playerId"];
    let color = arg["color"];
    // console.log(id, color);
    if (!playerList[id]) {  // check if player exists
      console.log("player does not exist yet");
      setPlayer(id, color);  // set player 
    }
    // console.log(callback);
    socket.emit("playerToClient", playerList);
    callback({
      playerStatus: true,
    })
  });

  /***
   * send playerList object from server to client via client request
   */
  socket.on("getPlayers", (callback) => {
    socket.emit("playerToClient", playerList);
    callback({
      players: playerList,
    })
  });

  // socket.on("updateAfterGame", (callback) => {
  socket.on("initializeServer", (arg, callback) => {
    console.log("initializing the server");
    if (arg["activeGame"]) { // check if initializeServer has an active game flag set by resetGame (after victory condition is met)
      activeGame = arg["activeGame"];
      console.log("activeGame: ", activeGame, arg["activeGame"]);
    }
    console.log("before: ", activeGame);
    if (activeGame == false) { // if activeGame flag is false, set collectible and playerList to empty
      collectible = {};
      playerList = {};
      activeGame = true;  // setting this flag means it is now an active game
    } else {  // if activeGame is true, collectible and at least 1 player is active
      activeGame = false;
    }
    console.log("after: ", activeGame);
    socket.emit("playerToClient");  // emit to all clients the player list
    socket.emit("collectibleToClient"); // emit to all clients the collectible
    callback({
      players: playerList,
      item: collectible,
      activeGame: activeGame,
    });
  });

  /***
   * Get the players from client side and update the playerList object with their properties
   */
  socket.on("updatePlayerOnServer", (args) => {
    // console.log("updating player on server...");
    for (const [key, value] of Object.entries(args)) {  // iterate through player list from client
      if (value["id"] == socket.id) {
        let collisionResults = checkCollision(value["id"], value["x"], value["y"]);
        let collisionOperation = collisionResults["board"] == true || collisionResults["player"] == true; //checks if player collides with board or player
        if (collisionOperation) { // if player collides with another player of the board
          playerList[key]["x"] = playerList[key]["x"] == value["x"] ? value["x"] : playerList[key]["x"];
          playerList[key]["y"] = playerList[key]["y"] == value["y"] ? value["y"] : playerList[key]["y"];
          let playerStartPts = [playerList[key]["x"], playerList[key]["y"]];
          let playerEndPts = [playerList[key]["x"] + 25, playerList[key]["y"] + 40];    // assign x, y values for player end coordinates
          playerList[key]["edgeCoordinates"] = getEdgeCoordinates(playerStartPts, playerEndPts);
        } else {  // if player collides with collectible 
          if (collisionResults["collectible"] == true) {
            playerList[key]["score"] += collectible["score"];
            socket.emit("collectibleCollided", key, collectible);  // signal client that a collectible has been collided with by a player
            collectible = {};
            setCollectible(); // create collectible with new coordinates
            socket.emit("collectibleToClient", collectible);  // send new collectible object to client to be drawn
          }
          playerList[key]["x"] = value["x"];
          playerList[key]["y"] = value["y"];
          let playerStartPts = [playerList[key]["x"], playerList[key]["y"]];
          let playerEndPts = [playerList[key]["x"] + 25, playerList[key]["y"] + 40];    // assign x, y values for player end coordinates
          playerList[key]["edgeCoordinates"] = getEdgeCoordinates(playerStartPts, playerEndPts);
        }
      }
    }
  });

  // user disconnects or refreshes
  socket.on("disconnecting", (reason) => {
    delete playerList[socket.id];  // remove specific client using their socket.id
    io.emit("clientDisconnect", socket.id);
    console.log(`Client ${socket.id} disconnected: ${reason}`);
  });
});
/*** End: Implementation v2 ***/

server.listen(portNum, () => {
  console.log(`Listening on port ${portNum}`);
  if (process.env.NODE_ENV==='test') {
    console.log('Running Tests...');
    setTimeout(function () {
      try {
        runner.run();
      } catch (error) {
        console.log('Tests are not valid:');
        console.error(error);
      }
    }, 1500);
  }
});

module.exports = app; // For testing
