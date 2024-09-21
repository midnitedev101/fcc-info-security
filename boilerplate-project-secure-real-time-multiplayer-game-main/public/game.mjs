import Player from './Player.mjs';
import Collectible from './Collectible.mjs';

// Solutions inspired by: 
// https://replit.com/@andyb123/FCC-Secure-Real-Time-Multiplayer-Game-InfoSec-Project-5#server.js
// https://forum.freecodecamp.org/t/looking-for-some-direction-on-the-secure-real-time-multiplayer-game-project-information-security/586018/2
// https://www.youtube.com/watch?v=7Azlj0f9vas
// https://www.youtube.com/watch?v=e17Lv35Tm-8
// https://codesandbox.io/p/github/batz-gg/FCC-Secure-Real-Time-Multiplayer-Game-InfoSec-Project-5/main?file=%2Fserver.js *
// https://letientai.io/freecodecamp/infosec/game/
// https://www.youtube.com/watch?v=ppcBIHv_ZPs
// https://github.com/pinglu85/fcc-secure-real-time-multiplayer-game/blob/main/public/game.mjs

const socket = io({transports: ['websocket'], upgrade: false}); // Use this option to prevent player instance from propagating when refreshing page subsequently
const canvas = document.getElementById('game-window');  // target canvas element 
const context = canvas.getContext('2d', { willReadFrequently: true });    // allow drawing methods to be called on canvas drawing context
const scoreboard = document.getElementById('player_score');
const rank = document.getElementById('player_rank');
let win_status = document.getElementById('win_status');
let reset_label = document.getElementById('reset_label');
// let game_reset = document.getElementById('game_reset');
let gameReq;

/*** Start: Implementation v2 ***/
let playerId;
let collectible;
let player = {};
let playerColor = {}; // adds random color outline on image (optional)
let drawPlayerSignal = false;   // player flag to prevent flickering upon moving
let drawCollectibleSignal = false;  // collectible flag to prevent flickering upon moving
let activeGame = false;    // new game flag from client
const pressedKeys = {};

/***
 * Draw collectible in the form of a coin to be placed randomly across the board
 * from its coordinates
 */
function drawCollectible() {
    const collectibleImage = new Image(40, 40); // Using optional size for image
    collectibleImage.src = "./public/assets/coin_copy.png";
    if (collectibleImage.complete) {    // checks if collectible image has already been loaded
        context.drawImage(collectibleImage, collectible["x"], collectible["y"], 14, 20);    
    } else {    // if not, listen to the load event
        collectibleImage.onload = () => {
            context.drawImage(collectibleImage, collectible["x"], collectible["y"], 14, 20);
        };
    }
}

/***
 * Draw player
 * from its coordinates
 */
function drawPlayer() {
    const playerImage = new Image(50, 50); // Using optional size for image
    playerImage.src = "./public/assets/chibi_char_orig.png";
    
    /*** 
     * Change Player image color - https://codepen.io/szkmsy/pen/LovBVe and https://www.tutorialspoint.com/change-colour-of-an-image-drawn-on-an-html5-canvas-element
    */
    if (playerImage.complete) {    // checks if player image has already been loaded
        for (const key in player) {   
            context.shadowColor = playerColor[key];
            context.shadowOffsetX = 0;
            context.shadowOffsetY = 0;
            context.shadowBlur = 5;
            context.lineWidth = 3;
            context.drawImage(playerImage, player[key]["x"], player[key]["y"], 25, 40);
        }
    } else {
        playerImage.onload = () => {    // if not, listen to the load event
            for (const key in player) {
                context.shadowColor = playerColor[key];
                context.shadowOffsetX = 0;
                context.shadowOffsetY = 0;
                context.shadowBlur = 5;
                context.lineWidth = 3;
                context.drawImage(playerImage, player[key]["x"], player[key]["y"], 25, 40);
            }
        }
    }
}

/***
 * Socket actions when connection to the server is established
 */
socket.on("connect", () => {    // connect with socket.io and initialize player
    let gameIsActive = undefined;    // supposed to be undefined
    socket.emit("initializeServer", {activeGame: gameIsActive}, (response) => {
        // if (response.activeGame == true) {
            
        // }
        console.log(response.activeGame);
        initialize();
    });
});

function initialize() {
    console.log("initializing");
    reset_label.textContent = "";
    let collectibleStatus = false;  // flag that indicates collectible existence
    let playerStatus = false;   // flag that indicates player existence
    const socketInfo = socket; // info about the current socket for the client
    playerId = socketInfo.id; // store socket id as the player id for uniqueness
    context.clearRect(0, 0, canvas.width, canvas.height);

    let color = "rgb(" + Math.ceil(255 * Math.random()) + "," + Math.ceil(255 * Math.random()) + "," + Math.ceil(255 * Math.random()) + ")";

    socket.emit("generatePlayer", {playerId: playerId, color: color}, (response) => {
        console.log(response.playerStatus);
        playerStatus = response.playerStatus;
    });

    // Check if server has collectible first
    socket.emit("getCollectible", (getResponse) => {
        if (!getResponse.item["id"]) {   // Create collectible if it does not exist, check if it conflicts with any player coordinates
            console.log("collectible not exists yet");
            socket.emit("setCollectible", (setResponse) => {
                console.log(setResponse.collectibleStatus);
                console.log(setResponse.collectibleValue);
                let collectibleStat = setResponse.collectibleValue;
                if (!collectible["id"]) {
                    collectible = new Collectible({x: collectibleStat["x"], y: collectibleStat["y"], value: collectibleStat["score"], id: collectibleStat["id"]});
                } 
                // else {
                //     console.log(collectible);
                // }
                collectibleStatus = setResponse.collectibleStatus;
            });
        } else {
            collectible = new Collectible({x: getResponse.item["x"], y: getResponse.item["y"], value: getResponse.item["score"], id: getResponse.item["id"]});
            // console.log(collectible);
            collectibleStatus = true;
        }
    });

    var initializeTimer = setInterval(() => { // until both player and collectible has been created, set a timer to wait for both their status flags to be true
        if (playerStatus && collectibleStatus) {
            clearInterval(initializeTimer);
            console.log("player and collectible created");
            // console.log(player);
            // console.log(collectible);
            gameReq = requestAnimationFrame(reAnimate);
        }
    }, 1000);
}

function reAnimate(timeStamp) {
    // console.log("reanimating...")
    // console.log(drawPlayerSignal);
    // console.log(drawCollectibleSignal);

    context.clearRect(0, 0, canvas.width, canvas.height);

    socket.emit("getPlayers", (response) => {
        // console.log(response.players);
    });  // retrieve player objects from server to client
    socket.emit("getCollectible", (response) => {
        // console.log(response.item);
    });  // retrieve collectible object from server to client

    if (drawPlayerSignal) {
        drawPlayer();
        drawPlayerSignal = false;
    }

    if (drawCollectibleSignal) {
        drawCollectible();
        drawCollectibleSignal = false;
    }
    gameReq = requestAnimationFrame(reAnimate);
}

function resetGame() {
    console.log("cancelling reanimation");
    cancelAnimationFrame(gameReq);
    // context.clearRect(0, 0, canvas.width, canvas.height);
    let cntDown = 10;

    var downloadTimer = setInterval(function() {
        if(cntDown <= 0) {
            clearInterval(downloadTimer);

            player = {};
            collectible = undefined;
            drawPlayerSignal = false;
            drawCollectibleSignal = false;
            win_status.innerHTML = "";

            console.log("going...");
            // socket.emit("updateAfterGame", (response) => {  // reinitialize game by resetting players, collectible instances

            // need to set server flag, activeGame to false to reset collectible and player instances
            let gameIsActive = false;  // client flag to denote that current game is over (needs new game) collectible and player needs to be cleared
            // socket.emit("initializeServer", {activeGame: gameIsActive}, (response) => {  // reinitialize game by resetting players, collectible instances
            socket.emit("initializeServer", {activeGame: gameIsActive}, (response) => {  // reinitialize game by resetting players, collectible instances
                // need to reinitialize
                // console.log("About to initialize after someone won");
                console.log(response.activeGame);
                initialize();

            });
            // socket.emit("updateAfterGame");
        }
        // document.getElementById("progressBar").value = 10 - cntDown;
        // game_reset.textContent = `Game will be restarting in ${cntDown} seconds...`;
        reset_label.textContent = `Game will be restarting in ${cntDown} seconds...`;
        cntDown -= 1;
    }, 1000);
}

/***
 * Event receiver after generating player
 */
socket.on("playerToClient", (args) => {
    // console.log(args);
    player = {};    // makes sure player list from server will be up to date, based on server's results (even when server code is updated)
    let pList = [];
    for (const property in args) {  // iterate over the properties of the player and assign to the player object
        let subProperty = args[property];
        player[property] = new Player({x: subProperty["x"], y: subProperty["y"], score: subProperty["score"], id: subProperty["id"]});  // set collectible as an instance of the Collectible class
        pList.push(player[property]);
        playerColor[property] = subProperty["playerColor"];
    }

    if (player[playerId]) {
        scoreboard.innerHTML = player[playerId]["score"];
        if (player[playerId]["score"] >= 50) {
            win_status.innerHTML = `Player ${playerId} has won!`;
            resetGame();
        }
        rank.innerHTML = player[playerId].calculateRank(pList);
        drawPlayerSignal = true;
    }
});

/***
 * Event receiver after generating collectible
 */
socket.on("collectibleToClient", (args) => {
    // console.log("collectibleToClient");
    if (args) {
        collectible = new Collectible({x: args["x"], y: args["y"], value: args["score"], id: args["id"]});  // set collectible as an instance of the Collectible class
        drawCollectibleSignal = true;
    }
});

socket.on("collectibleCollided", (id, item) => {
    if (collectible["id"] == item["id"]) {
        player[id].collision(collectible);  // call Player class collision method to determine if item collided with is of Collectible class
        socket.emit("getPlayers", (response) => {
            // console.log(response.players)
        });  // retrieve player objects from server to client
    }
});

document.addEventListener("keydown", (event) => {
    // const keyCode = event.key;
    let keyCodeValid = false;
    let speed = 5;
    pressedKeys[event.key] = true;

    event.preventDefault();
    if (pressedKeys["a"] || pressedKeys["ArrowLeft"]) {
        // console.log("a");
        player[playerId].movePlayer("left", speed);
        // event.preventDefault();
        keyCodeValid = true;
    } else if (pressedKeys["w"] || pressedKeys["ArrowUp"]) {
        // console.log("w");
        player[playerId].movePlayer("up", speed);
        // event.preventDefault();
        keyCodeValid = true;
    } else if (pressedKeys["d"] || pressedKeys["ArrowRight"]) {
        // console.log("d");
        player[playerId].movePlayer("right", speed);
        // event.preventDefault();
        keyCodeValid = true;
    } else if (pressedKeys["s"] || pressedKeys["ArrowDown"]) {
        // console.log("s");
        player[playerId].movePlayer("down", speed);
        // event.preventDefault();
        keyCodeValid = true;
    }

    // Handle diagonal movement
    if ((pressedKeys["a"] || pressedKeys["ArrowLeft"]) && (pressedKeys["w"] || pressedKeys["ArrowUp"])) {
        // console.log("aw");
        player[playerId].movePlayer("upleft", speed);
        // event.preventDefault();
        keyCodeValid = true;
    } else if ((pressedKeys["a"] || pressedKeys["ArrowLeft"]) && (pressedKeys["s"] || pressedKeys["ArrowDown"])) {
        // console.log("as");
        player[playerId].movePlayer("downleft", speed);
        // event.preventDefault();
        keyCodeValid = true;
    } else if ((pressedKeys["d"] || pressedKeys["ArrowRight"]) && (pressedKeys["w"] || pressedKeys["ArrowUp"])) {
        // console.log("dw");
        player[playerId].movePlayer("upright", speed);
        // event.preventDefault();
        keyCodeValid = true;
    } else if ((pressedKeys["d"] || pressedKeys["ArrowRight"]) && (pressedKeys["s"] || pressedKeys["ArrowDown"])) {
        // console.log("ds");
        player[playerId].movePlayer("downright", speed);
        // event.preventDefault();
        keyCodeValid = true;
    }
   
    if (keyCodeValid) {
        // context.clearRect(0, 0, canvas.width, canvas.height);
        socket.emit("updatePlayerOnServer", player);  // send player list to server after moving
        // requestAnimationFrame(reAnimate);
    }
}, true);

document.addEventListener("keyup", (event) => {
//     // const keyCode = event.key;
    // let keyCodeValid = false;
//     let speed = 0;

    event.preventDefault();
    delete pressedKeys[event.key];
}, true);


/*** 
 * Receive event from server that a player has disconnected 
 */
socket.on("clientDisconnect", (playerId) => {
    console.log("client disconnecting");
    cancelAnimationFrame(gameReq);
    delete player[playerId];
    socket.emit("getPlayers", (response) => {
        console.log(response.players)
    });  // retrieve player objects from server to client
    socket.emit("getCollectible", (response) => {
        console.log(response.item);
    });  // retrieve collectible object from server to client
})
/*** End: Implementation v2 ***/