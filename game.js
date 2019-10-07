window.requestAnimFrame = (function() {
    return window.requestAnimationFrame      ||
        window.webkitRequestAnimationFrame   ||
        window.mozRequestAnimationFrame      ||
        window.oRequestAnimationFrame        ||
        window.msRequestAnimationFrame       ||
        function(callback, element) {
            window.setTimeout(callback, 1000/60);
        };
})();

var won = false;

var sfx = {
    youwon: new Audio('youwon.wav'),
    annihilate: new Audio('annihilate.wav'),
    no: new Audio('no.wav'),
    undo: new Audio('undo.wav'),
    reset: new Audio('reset.wav'),
    step: new Audio('step.wav'),
    pawncreate: new Audio('pawncreate.wav'),
    antipawncreate: new Audio('antipawncreate.wav'),
    overallwin: new Audio('overallwin.wav'),
};

var tutorialImages = [
    // 1:
    [ new Image(), new Image(), new Image(), new Image(), new Image() ],

    null, // 2

    // 3:
    [ new Image() ],

    null, // 4

    // 5:
    [ new Image() ],

    null, // 6
    null, // 7
    null, // 8
    null, // 9

    // 10:
    [ new Image() ],    // 10

    null, // 11
    null, // 12
    null, // 13
    null, // 14
    null, // 15
    null, // 16
    null, // 17
    null, // 18
    null, // 19
    null, // 20

    // 21: (victory screen)
    [ new Image(), new Image(), ],

];

var currTut = [];
var review = false;
var allTutorial = [];

var victory_level = [
    0,0,0,0,0,0,0,0,0,0,
    0,0,0,3,0,0,3,0,0,0,
    0,0,0,0,0,0,0,0,0,0,
    0,0,3,0,0,0,0,3,0,0,
    0,0,0,3,3,3,3,0,0,0,
    0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,
];

tutorialImages[0][0].src = 'titlescreen.png';
tutorialImages[0][1].src = 'intro.png';
tutorialImages[0][2].src = 'intro2.png';
tutorialImages[0][3].src = 'intro3.png';
tutorialImages[0][4].src = 'intro4.png';
tutorialImages[2][0].src = 'tutorial1.png';
tutorialImages[4][0].src = 'tutorial2.png';
tutorialImages[9][0].src = 'tutorial3.png';
tutorialImages[20][0].src = 'victory1.png';
tutorialImages[20][1].src = 'victory2.png';

var tutorialIndex;

var sprites;

var objs = [];
var objs = [];

var checkerColors = [ '255,255,255', '0,255,255' ];
var noPlaceColors = ['0,255,0', '0,130,0' ];

var tileSize = 16;
var drawScale = 4;
var canvasW = 640;
var canvasH = 448;

var levelW = canvasW / tileSize / drawScale;
var levelH = canvasH / tileSize / drawScale;

var levelNumber = 1;

var level = levels[0];

var framestep = 1000/60;

var canvas;

var prevObjs = [];

var continueImage = new Image();
continueImage.src = 'click-to-continue.png';

var headerImage = new Image();
headerImage.src = 'header.png';

var headerWinImage = new Image();
headerWinImage.src = 'header-win.png';

var digitsImage = new Image();
digitsImage.src = 'digits.png';

const ID = {
    selector: 4,
    yellow_pawn: 0,
    blue_pawn: 1,
    plate: 2,
    noplace: 7,
    noplace_plate: 8,
    explosion: 5,
}

// STAND: ready for input
// PLACE: we placed the yellow pawn and are waiting to put a blue one
// MOVE: we're in the middle of a move so not reading input yet
// DONE: showing 'click to continue' message
// READ: reading tutorial text
var State = { STAND : 0, PLACE : 1, MOVE : 2, DONE : 3, READ : 4 };

var gameState;

ready(function() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;

    sprites = new Image();
    sprites.onload = function() {
        initialize();
    }
    sprites.src = 'sprites.png';
});

function initialize() {
    levelNumber = 0;
    advanceLevel();

    loop();
}

var keepGoing = true;
var lastFrameTime;
var timedelta = 0;
function loop(timestamp) {
    if (timestamp == undefined) {
        timestamp = 0;
        lastFrameTime = timestamp;
    }
    timedelta += timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    while (timedelta >= framestep) {
        update(framestep);
        timedelta -= framestep;
    }
    draw();

    if (keepGoing) {
        requestAnimFrame(loop);
    }
}

document.onmousemove = function(e) {
    const rect = canvas.getBoundingClientRect();
    var selectorX = Math.floor((e.clientX - rect.left) / drawScale / tileSize);
    var selectorY = Math.floor((e.clientY - rect.top) / drawScale / tileSize);

    // remove current selector if any and add new one if in bounds of canvas
    objs = objs.filter(o => o.id != ID.selector);
    if (selectorX >= 0 && selectorX < levelW && selectorY >= 0 && selectorY < levelH) {
        if (gameState == State.STAND
                || gameState == State.PLACE
                && placeStateInfo.positions.filter(p => p[0] == selectorX && p[1] == selectorY).length > 0) {
            if (canPlaceAt(selectorX, selectorY)) {
                objs.push({ id: ID.selector, x: selectorX, y: selectorY});
            }
        }
    }
}

var FLASH_SPEED = 500;

var placeStateInfo = {
    positions: [],
    colors: ['255,0,0', '130,0,0'],
    colorId: 0,
    colorTimer: FLASH_SPEED,
}

function tileAt(x, y) {
    // We pretend like everything outside the level is the same as the border.
    y = Math.max(0, Math.min(levelH - 1, y));
    x = Math.max(0, Math.min(levelW - 1, x));
    return level[y * levelW + x];
}

function tileOpen(x, y) {
    return tileAt(x, y) == 0 || tileAt(x, y) == ID.plate || tileAt(x, y) == ID.noplace || tileAt(x, y) == ID.noplace_plate;
}

function tileClear(x, y) {
    y = Math.max(Math.min(y, levelH), 0);
    x = Math.max(Math.min(x, levelW), 0);
    var objs_on_tile = objs.filter(o => o.x == x && o.y == y);
    return (objs_on_tile.length == 0 && tileOpen(x, y));
}

function canPlaceAt(x, y) {
    return tileClear(x, y) && tileAt(x, y) != ID.noplace && tileAt(x, y) != ID.noplace_plate;
}

last_placed_pawn_coords = [];

document.onmousedown = function(e) {
    const rect = canvas.getBoundingClientRect();
    var selectorX = Math.floor((e.clientX - rect.left) / drawScale / tileSize);
    var selectorY = Math.floor((e.clientY - rect.top) / drawScale / tileSize);
    var inbounds = selectorX >= 0 && selectorX < levelW && selectorY >= 0 && selectorY < levelH;

    if (gameState == State.STAND) {
        // place yellow pawn
        selector = objs.filter(o => o.id == ID.selector);
        if (selector.length > 0) {
            backupState();
            objs.push({ id: ID.yellow_pawn, x: selector[0].x, y: selector[0].y });
            objs = objs.filter(o => o.id != ID.selector);

            // switch to place-blue-pawn state and find where to put flashing squares
            gameState = State.PLACE;
            placeStateInfo.positions = [];
            var adjacents = [ [ selector[0].x + 1, selector[0].y ],
                              [ selector[0].x, selector[0].y + 1 ],
                              [ selector[0].x - 1, selector[0].y ],
                              [ selector[0].x, selector[0].y - 1 ] ];

            var any_open_square = false;
            for (var i in adjacents) {
                if (canPlaceAt(adjacents[i][0], adjacents[i][1])) {
                    placeStateInfo.positions.push(adjacents[i]);
                    any_open_square = true;
                }
            }

            // if no adjacent squares, we can't place the original one either
            if (!any_open_square) {
                objs = objs.filter(o => o.x != selector[0].x || o.y != selector[0].y);
                gameState = State.STAND;
                // un-backup the undo state
                sfx.no.currentTime = 0;
                sfx.no.play();
                prevObjs.pop();
            } else {
                sfx.pawncreate.currentTime = 0;
                sfx.pawncreate.play();
                last_placed_pawn_coords = [ selector[0].x, selector[0].y ];
            }
        } else if (inbounds) {
            sfx.no.currentTime = 0;
            sfx.no.play();
        }
    } else if (gameState == State.PLACE) {
        selector = objs.filter(o => o.id == ID.selector);
        if (selector.length > 0) {
            objs.push({ id: ID.blue_pawn, x: selector[0].x, y: selector[0].y });
            objs = objs.filter(o => o.id != ID.selector);

            placeStateInfo.positions = [];

            sfx.antipawncreate.currentTime = 0;
            sfx.antipawncreate.play();
            gameState = State.STAND;
        } else if (inbounds) {
            sfx.no.currentTime = 0;
            sfx.no.play();
        }
    } else if (gameState == State.DONE) {
        advanceLevel();
    } else if (gameState == State.READ) {
        advanceTutorial();
    }
}

var first_time_win = true;
function win() {
    won = true;
    level = victory_level;
    objs = [];
    pastObjs = [];
    if (first_time_win) {
        sfx.youwon.pause();
        sfx.overallwin.play();
        allTutorial = [];
        first_time_win = false;
    }
}

function advanceTutorial() {
    if (!review && (tutorialIndex != 0 || levelNumber != 1)) {
        allTutorial.push(tutorialImages[levelNumber - 1][tutorialIndex]);
        console.log(allTutorial);
    }

    tutorialIndex ++;
    if (tutorialIndex == currTut.length) {
        review = false;
        gameState = State.STAND;
    }
}

function advanceLevel() {
    levelNumber ++;

    if (levelNumber > levels.length) {
        win();
        gameState = State.STAND;
    } else {
        prevObjs = [];
        objs = [];
        level = levels[levelNumber - 1];

        gameState = State.STAND;
    }

    if (tutorialImages[levelNumber - 1]) {
        tutorialIndex = 0;
        currTut = tutorialImages[levelNumber - 1];
        gameState = State.READ;
    }
}

var moveFraction = 0;

function check_move(obj) {
    if (!tileOpen(obj.target_x, obj.target_y)) {
        // This means we tried to move it into a solid object.
        return false;
    }

    var obstacle = objs.filter(o => o.x == obj.target_x && o.y == obj.target_y);
    if (obstacle.length > 0) {
        if (obstacle[0].id == obj.id) {
            return check_move(obstacle[0]);
        } else {
            // Annihilation halfway! Exciting! But they still get to move.
            obj.annihilate_halfway = true;
            return true;
        }
    } else {
        return true;
    }
}

function checkVictory() {
    // need every object to be on a plate...
    for (var i in objs) {
        if (tileAt(objs[i].x, objs[i].y) != ID.plate && tileAt(objs[i].x, objs[i].y) != ID.noplace_plate) {
            return;
        }
    }

    // and every plate to have an object on it
    for (var i in level) {
        var lx = i % levelW;
        var ly = Math.floor(i / levelW);
        if (level[i] == ID.plate || level[i] == ID.noplace_plate) {
            if (objs.filter(o => o.x == lx && o.y == ly).length == 0) {
                return;
            }
        }
    }

    gameState = State.DONE;

    sfx.youwon.currentTime = 0;
    sfx.youwon.play();
}

function do_move(dx, dy) {
    if (gameState == State.STAND) {
        backupState();
        objs = objs.filter(o => o.id != ID.selector);

        yellow_objs = objs.filter(o => o.id == ID.yellow_pawn);
        blue_objs = objs.filter(o => o.id == ID.blue_pawn);

        for (var i in yellow_objs) {
            yellow_objs[i].can_move = true;
            yellow_objs[i].target_x = yellow_objs[i].x + dx;
            yellow_objs[i].target_y = yellow_objs[i].y + dy;
        }

        for (var i in blue_objs) {
            blue_objs[i].can_move = true;
            blue_objs[i].target_x = blue_objs[i].x - dx;
            blue_objs[i].target_y = blue_objs[i].y - dy;
        }

        // Now that they have their targets, check that they can move
        // taking into account all other objects' moves.
        for (var i in objs) {
            if (!check_move(objs[i])) {
                objs[i].can_move = false;
            }
        }

        for (var i in objs) {
            if (!objs[i].can_move) {
                delete objs[i].target_x;
                delete objs[i].target_y;
            }
        }

        realMoveFraction = 0;
        moveFraction = 0;
        sfx.step.currentTime = 0;
        sfx.step.play();
        gameState = State.MOVE;
    }
}

function backupState() {
    var stateBackup = [];
    for (var i in objs) {
        objCopy = {};
        for (var j in objs[i]) {
            if (j != 'target_x' && j != 'target_y') {
                objCopy[j] = objs[i][j];
            }
        }
        if (objCopy.id != ID.selector) {
            stateBackup.push(objCopy);
        }
    }
    prevObjs.push(stateBackup);
}

document.onkeydown = function(e) {
    if (gameState == State.READ) {
        advanceTutorial();
    } else if (gameState == State.DONE) {
        if (e.keyCode == 82) {
            reset();
        } else if (e.keyCode == 90) {
            undo();
        } else {
            advanceLevel();
            e.preventDefault();
        }
    } else {
        if (e.keyCode >= 37 && e.keyCode <= 40) {
            switch (e.keyCode) {
                case 37:
                    do_move(-1, 0);
                    break;
                case 38:
                    do_move(0, -1);
                    break;
                case 39:
                    do_move(1, 0);
                    break;
                case 40:
                    do_move(0, 1);
                    break;
            }
            e.preventDefault();
        } else if (e.keyCode == 90) {
            // z
            undo();
        } else if (e.keyCode == 82) {
            // r
            reset();
        } else if (e.keyCode == 72) {
            // h
            tutorialIndex = 0;
            currTut = allTutorial;
            review = true;
            console.log(currTut);
            gameState = State.READ;
        }
    }
}

function reset() {
    objs = [];
    gameState = State.STAND;
    placeStateInfo.positions = [];

    sfx.reset.currentTime = 0;
    sfx.reset.play();
}

function undo() {
    if (gameState == State.PLACE) {
        sfx.undo.currentTime = 0;
        sfx.undo.play();
        objs = objs.filter(o => o.x != last_placed_pawn_coords[0] || o.y != last_placed_pawn_coords[1]);
        placeStateInfo.positions = [];
    } else {
        if (prevObjs.length > 0) {
            sfx.undo.currentTime = 0;
            sfx.undo.play();
            objs = prevObjs.pop();
        }
    }
    gameState = State.STAND;
}

var realMoveFraction = 0;
var MOVE_LENGTH = 0.3;

var explosionLength = 500;
var explosionTimer = 0;

function update(delta) {
    if (gameState == State.PLACE) {
        placeStateInfo.colorTimer -= delta;
        if (placeStateInfo.colorTimer <= 0) {
            placeStateInfo.colorTimer += FLASH_SPEED;
            placeStateInfo.colorId ++;
            placeStateInfo.colorId %= 2;
        }
    }

    if (gameState == State.MOVE) {
        yellow_objs = yellow_objs.filter(o => o.id != ID.explosion);
        blue_objs = blue_objs.filter(o => o.id != ID.explosion);

        if (explosionTimer == 0) {
            objs = objs.filter(o => o.id != ID.explosion);

            realMoveFraction += delta / (MOVE_LENGTH * 1000);
            moveFraction = Math.sqrt(realMoveFraction);
            var halfway_delete = objs.filter(o => o.annihilate_halfway);
            if (moveFraction > 0.5 && halfway_delete.length > 0) {
                for (var i in objs) {
                    if (objs[i].annihilate_halfway) {
                        objs[i].id = ID.explosion;
                        explosionTimer = explosionLength;
                        sfx.annihilate.currentTime = 0;
                        sfx.annihilate.play();
                    }
                }
            } else if (moveFraction > 1) {
                realMoveFraction = 0;
                for (var i in objs) {
                    if (objs[i].hasOwnProperty('target_x')) {
                        objs[i].x = objs[i].target_x;
                    }
                    if (objs[i].hasOwnProperty('target_y')) {
                        objs[i].y = objs[i].target_y;
                    }
                }
                var any_exploded = false;
                for (var i in yellow_objs) {
                    blue_samespot = blue_objs.filter(o => o.x == yellow_objs[i].x && o.y == yellow_objs[i].y);
                    if (blue_samespot.length > 0) {
                        console.log("oh no");
                        any_exploded = true;
                        blue_samespot[0].id = ID.explosion;
                        yellow_objs[i].id = ID.explosion;
                    }
                }
                if (any_exploded) {
                    explosionTimer = explosionLength;
                    sfx.annihilate.currentTime = 0;
                    sfx.annihilate.play();
                } else {
                    gameState = State.STAND;
                    checkVictory();
                }
            }
        } else {
            explosionTimer -= delta;
            for (var i in objs) {
                if (objs[i].id == ID.explosion) {
                    objs[i].frame = Math.min(3, Math.floor((1 - explosionTimer / explosionLength) * 4));
                }
            }
            if (explosionTimer <= 0) {
                explosionTimer = 0;
            }
        }
    }

    objs = objs;
}

function draw() {
    ctx.save();
    ctx.scale(drawScale, drawScale);

    for (var y = 0; y < levelH; y++) {
        for (var x = 0; x < levelW; x++) {
            if (tileAt(x, y) != ID.noplace && tileAt(x, y) != ID.noplace_plate) {
                ctx.fillStyle = 'rgb(' + checkerColors[(x + y) % 2] + ')';
            } else {
                ctx.fillStyle = 'rgb(' + noPlaceColors[(x + y) % 2] + ')';
            }
            ctx.beginPath();
            ctx.rect(x * tileSize, y * tileSize, tileSize, tileSize);
            ctx.fill();
        }
    }

    for (var i in placeStateInfo.positions) {
        ctx.fillStyle = 'rgb(' + placeStateInfo.colors[placeStateInfo.colorId] + ')';
        ctx.beginPath();
        ctx.rect(placeStateInfo.positions[i][0] * tileSize, placeStateInfo.positions[i][1] * tileSize, tileSize, tileSize);
        ctx.fill();
    }

    for (var i in level) {
        var elem_y = Math.floor(i / levelW);
        var elem_x = i % levelW;

        if (level[i]) {
            ctx.drawImage(sprites,
                    level[i] * tileSize, 0, tileSize, tileSize,
                    elem_x * tileSize, elem_y * tileSize, tileSize, tileSize);
        }
    }

    for (var i in objs) {
        if (!objs[i].hasOwnProperty('target_x')) {
            ctx.drawImage(sprites,
                    objs[i].id * tileSize, (objs[i].frame || 0) * tileSize, tileSize, tileSize,
                    objs[i].x * tileSize, objs[i].y * tileSize, tileSize, tileSize);
        } else {
            ctx.drawImage(sprites,
                    objs[i].id * tileSize, (objs[i].frame || 0) * tileSize, tileSize, tileSize,
                    // divide and round for pixel-y movement
                    Math.round((objs[i].x * (1 - moveFraction) + objs[i].target_x * moveFraction) * tileSize) / tileSize * tileSize,
                    Math.round((objs[i].y * (1 - moveFraction) + objs[i].target_y * moveFraction) * tileSize) / tileSize * tileSize,
                    tileSize, tileSize);
        }
    }

    if (gameState == State.DONE) {
        ctx.drawImage(continueImage, 0, 0);
    }

    if (!won) {
        ctx.drawImage(headerImage, 0, levelH * tileSize);

        var num = levelNumber;
        var place = 1;
        while (num > 0) {
            var digit = num % 10;
            ctx.drawImage(digitsImage, 5 * digit, 0, 5, 5, levelW * tileSize - 5 * place - 17, levelH * tileSize + 2, 5, 5);
            num = Math.floor(num / 10);
            place ++;
        }

        ctx.drawImage(digitsImage, 50, 0, 8, 5, levelW * tileSize - 5 * place - 5 - 17, levelH * tileSize + 2, 8, 5);

        var num = levels.length;
        var place = 1;
        while (num > 0) {
            var digit = num % 10;
            ctx.drawImage(digitsImage, 5 * digit, 0, 5, 5, levelW * tileSize - 5 * place - 1, levelH * tileSize + 2, 5, 5);
            num = Math.floor(num / 10);
            place ++;
        }
    } else {
        ctx.drawImage(headerWinImage, 0, levelH * tileSize);
    }

    if (gameState == State.READ) {
        ctx.drawImage(currTut[tutorialIndex], 0, 0);
    }

    ctx.restore();
}
