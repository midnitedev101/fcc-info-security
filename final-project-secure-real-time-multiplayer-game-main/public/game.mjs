import Player from './Player.mjs';
import Collectible from './Collectible.mjs';

const socket = io({transports: ['websocket'], upgrade: false}); // Use this option to prevent player instance from propagating when refreshing page subsequently
const canvas = document.getElementById('game-window');  // target canvas element 
const context = canvas.getContext('2d', { willReadFrequently: true });    // allow drawing methods to be called on canvas drawing context
const scoreboard = document.getElementById('player_score');
const rank = document.getElementById('player_rank');
let win_status = document.getElementById('win_status');
let reset_label = document.getElementById('reset_label');
let gameReq;

let playerId;
let collectible;
let player = {};
let playerColor = {}; // adds random color outline on image (optional)
let drawPlayerSignal = false;   // player flag to prevent flickering upon moving
let drawCollectibleSignal = false;  // collectible flag to prevent flickering upon moving
// let activeGame = false;    // new game flag from client
const pressedKeys = {};
let keyCodeValid = false;   // flag for when a button is pressed down
let allowKeyPress = false;  // flag to enable/disable keypress

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
        for (const [key, value] of Object.entries(player)) {
            context.shadowColor = playerColor[key];
            context.shadowOffsetX = 0;
            context.shadowOffsetY = 0;
            context.shadowBlur = 5;
            context.lineWidth = 3;
            context.drawImage(playerImage, player[key]["x"], player[key]["y"], 25, 40);
        }
    } else {
        playerImage.onload = () => {    // if not, listen to the load event
            for (const [key, value] of Object.entries(player)) {
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

document.addEventListener("keydown", (event) => {
    let speed = 5;
    pressedKeys[event.key] = true;

    event.preventDefault();
    if (allowKeyPress) {
        if (pressedKeys["a"] || pressedKeys["ArrowLeft"]) {
            player[playerId].movePlayer("left", speed);
            keyCodeValid = true;
        } else if (pressedKeys["w"] || pressedKeys["ArrowUp"]) {
            player[playerId].movePlayer("up", speed);
            keyCodeValid = true;
        } else if (pressedKeys["d"] || pressedKeys["ArrowRight"]) {
            player[playerId].movePlayer("right", speed);
            keyCodeValid = true;
        } else if (pressedKeys["s"] || pressedKeys["ArrowDown"]) {
            player[playerId].movePlayer("down", speed);
            keyCodeValid = true;
        }

        // Handle diagonal movement
        if ((pressedKeys["a"] || pressedKeys["ArrowLeft"]) && (pressedKeys["w"] || pressedKeys["ArrowUp"])) {
            player[playerId].movePlayer("upleft", speed);
            keyCodeValid = true;
        } else if ((pressedKeys["a"] || pressedKeys["ArrowLeft"]) && (pressedKeys["s"] || pressedKeys["ArrowDown"])) {
            player[playerId].movePlayer("downleft", speed);
            keyCodeValid = true;
        } else if ((pressedKeys["d"] || pressedKeys["ArrowRight"]) && (pressedKeys["w"] || pressedKeys["ArrowUp"])) {
            player[playerId].movePlayer("upright", speed);
            keyCodeValid = true;
        } else if ((pressedKeys["d"] || pressedKeys["ArrowRight"]) && (pressedKeys["s"] || pressedKeys["ArrowDown"])) {
            player[playerId].movePlayer("downright", speed);
            keyCodeValid = true;
        }
    
        if (keyCodeValid) {
            socket.emit("playerToServer", player[playerId]);
        }
    }
}, true);

document.addEventListener("keyup", (event) => {
    keyCodeValid = false;
    event.preventDefault();
    delete pressedKeys[event.key];
}, true);

/***
 * Socket actions when connection to the server is established
 */
socket.on("connect", () => {    // connect with socket.io and initialize player
    let color = "rgb(" + Math.ceil(255 * Math.random()) + "," + Math.ceil(255 * Math.random()) + "," + Math.ceil(255 * Math.random()) + ")";
    const socketInfo = socket; // info about the current socket for the client
    playerId = socketInfo.id; // store socket id as the player id for uniqueness
    allowKeyPress = true;

    player = {};
    collectible = undefined;
    drawPlayerSignal = false;
    drawCollectibleSignal = false;
    win_status.innerHTML = "";
    reset_label.textContent = "";

    context.clearRect(0, 0, canvas.width, canvas.height);
    socket.emit("initializeServer", {id: playerId, color: color}, (response) => {});
});

/***
 * Receive player list on client to draw in their coordinates and display player info
 */
socket.on("playerToClient", (args) => {
    let pList = [];
    for (const [key, value] of Object.entries(args)) {
        player[key] = new Player({x: value["x"], y: value["y"], score: value["score"], id: value["id"]});  // set player as an instance of the Player class
        playerColor[key] = value["playerColor"];
        pList.push(player[key]);
    }

    rank.innerHTML = player[playerId].calculateRank(pList);
    scoreboard.innerHTML = player[playerId]["score"];
    drawPlayer();
});

/***
 * Receive collectible on client to draw in their coordinates
 */
socket.on("collectibleToClient", (args) => {
    reset_label.textContent = "";
    collectible = new Collectible({x: args["x"], y: args["y"], value: args["score"], id: args["id"]});  // set collectible as an instance of the Collectible class
    drawCollectible();
});

/***
 * Receive event when player collides with collectible
 */
socket.on("collectibleCollided", (id, item) => {
    if (collectible["id"] == item["id"]) {
        player[id].collision(collectible);  // call Player class collision method to determine if item collided with is of Collectible class
    }
});

/***
 * Receive event when victory conditions are met and game needs to be restarted
 */
socket.on("resetGame", (id) => {
    let color = "rgb(" + Math.ceil(255 * Math.random()) + "," + Math.ceil(255 * Math.random()) + "," + Math.ceil(255 * Math.random()) + ")";
    let cntDown = 10;
    allowKeyPress = false;

    var downloadTimer = setInterval(function() {
        if(cntDown <= 0) {
            context.clearRect(0, 0, canvas.width, canvas.height);
            clearInterval(downloadTimer);

            player = {};
            collectible = undefined;
            drawPlayerSignal = false;
            drawCollectibleSignal = false;
            win_status.innerHTML = "";

            // need to set server flag, activeGame to false to reset collectible and player instances
            socket.emit("restartGame", {id: playerId, color: color}, (response) => {});  // reinitialize game by resetting players, collectible instances
            allowKeyPress = true;
        }
        reset_label.textContent = `Game will be restarting in ${cntDown} seconds...`;
        cntDown -= 1;
    }, 1000);
});

socket.on("clearBoard", () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
});

/*** 
 * Custom receive event from server that a player has disconnected 
 */
socket.on("clientDisconnect", (socketId) => {
    console.log("client disconnecting");
    delete player[socketId];
})

socket.on("disconnect", (reason, details) => {
    console.log("disconnecting...");
    console.log(reason);
 
    if (details) {
        // the low-level reason of the disconnection, for example "xhr post error"
        console.log(details.message);

        // some additional description, for example the status code of the HTTP response
        console.log(details.description);

        // some additional context, for example the XMLHttpRequest object
        console.log(details.context);
    }
});