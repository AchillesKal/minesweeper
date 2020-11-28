const gameState = {
  PLAYING: "PLAYING",
  WIN: "WIN",
  LOST: "LOST"
};

class Scene extends Phaser.Scene {
  boardSize = 100;
  state = {};
  tiles = [];
  minePositions = [];
  excluded = [];
  flags = 10;
  flagtext = "";
  numberOfMines = 0;
  tileSize = 26;
  boardPosition ={
    x: 140,
    y: 100
  }
  contactTiles = {
    full: [1,-1, 9, -9, 10, -10, 11, -11],
    left: [1, -9, 10, -10, 11],
    right: [-1, 9, 10, -10, -11]
  }

  constructor() {
    super();
    this.numberOfMines = 10;
  }

  initialize() {
    this.state = gameState.PLAYING;
    this.minePositions = this.generateMinePositions(this.numberOfMines);

    this.add.text(10, 50, 'Restart', { fill: '#0f0' })
      .setInteractive()
      .on('pointerdown', () => {
          this.scene.restart();
          this.minePositions = this.generateMinePositions(10);
      })
  }

  draw() {
    let currentX = this.boardPosition.x;
    let currentY = this.boardPosition.y;
    let currentFlags = "";

    for (let i = 1; i <= this.boardSize; i++) {

      if (this.tiles[i]["clicked"] === true) {
        this.add.image(currentX, currentY, 'gray-tile')
        if (this.tiles[i]["close"] !== 0) {
          this.add.text(currentX-4, currentY-7, this.tiles[i]["close"],{fill: "#000", align: "center"});
        } 
        
      } else {
        this.add.image(currentX, currentY, 'white-tile')
        .setInteractive()
        .on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, 
          (pointer) => {
            if (this.state == gameState.LOST || this.state == gameState.WIN) {
              return false;
            }

            if( pointer.button == 0) {
                
              if (this.tiles[i]["clicked"] === true || this.tiles[i]["flag"] === true) {
                return false;
              }

              if (this.tiles[i]["mine"] === true) {
                this.state = gameState.LOST;
              }

              this.zeroTiles(i);

              this.tiles[i]["clicked"] = true;

            } else if(pointer.button == 2) {
              if (this.tiles[i]["clicked"] === true) {
                return false;
              }
              
              if (this.flags <= 0 &&  !this.tiles[i]["flag"] == true) {
                return false;
              }

              this.tiles[i]["flag"] = !this.tiles[i][
                "flag"
              ];
            }
            
            this.draw();
          }
        );
      }

      if (
        this.state == gameState.LOST &&
        this.tiles[i]["mine"] === true
      ) {
        this.add.image(currentX, currentY, 'mine-tile')
      }
      if (this.tiles[i]["flag"] === true) {
        this.add.image(currentX, currentY, 'banner')
        currentFlags++;
      }
      currentX = currentX + this.tileSize;

      // Change row.
      if(i % 10 == 0) {
        currentY = currentY + this.tileSize;
        currentX = this.boardPosition.x;
      }

    }

    this.flags = 10 - currentFlags;

    if(this.flagtext !== "") {
      this.flagtext.setVisible(false);
    }

    this.flagtext = this.add.text(10, 10, "Flags: " + this.flags,{fill: "#FFF", align: "center"});
    
    if (this.checkWin()) {
      this.state = gameState.WIN;
      this.add.text(10, 30, "YOU WON",{fill: "#FFF", align: "center"});
    }

    if(this.state == gameState.LOST) {
      this.add.text(10, 30, "YOU LOST",{fill: "#FFF", align: "center"});
    }
  }

  zeroTiles(item) {
    item = parseInt(item);

    this.discoverZeros(item);
  }
  
  preload ()
  {
    this.load.image('gray-tile', 'assets/gray-tile.png');
    this.load.image('white-tile', 'assets/white-tile.png');
    this.load.image('mine-tile', 'assets/mine-tile.png');
    this.load.image('flag-tile', 'assets/flag-tile.png');
    this.load.image('banner', 'assets/banner.png');
  }

  create ()
  {
    this.input.mouse.disableContextMenu();
    this.initialize();
    
   
    for (let i = 1; i <= this.boardSize; i++) {
      this.tiles[i] = {};

      if (this.minePositions.indexOf(i) !== -1) {
        this.tiles[i]["mine"] = true;
      }
      
    }

    for (let i = 1; i <= this.boardSize; i++) {
      let number = this.tilesUntilMine(i);
      this.tiles[i]["close"] = number;
    }
    this.draw();     
  }

  discoverZeros(item) {
    let positionsToOpen = [];

    if (item % 10 == 0) {
      this.contactTiles.right.forEach(element => {
        if (element + item < 100 && element + item > 1) {
          if (this.tiles[item].close === 0 && this.tiles[item].mine !== true) {
            positionsToOpen.push(element + item);
          }
        }
      });
    } else if (item % 10 == 1) {
      this.contactTiles.left.forEach(element => {
        if (element + item <= 100 && element + item >= 1) {
          if (this.tiles[item].close === 0 && this.tiles[item].mine !== true) {
            positionsToOpen.push(element + item);
          }
        }
      });
    } else {
      this.contactTiles.full.forEach(element => {
        if (element + item <= 100 && element + item >= 1) {
          if (this.tiles[item].close === 0 && this.tiles[item].mine !== true) {
            positionsToOpen.push(element + item);
          }
        }
      });
    }

    positionsToOpen.forEach(element => {
      if (this.tiles[element].clicked !== true) {
        this.tiles[element].clicked = true;
        this.tiles[element]["flag"] = false;
        this.discoverZeros(element);
      }
    });

    if (positionsToOpen.length == 0) {
      return false;
    }

    return positionsToOpen;
  }

  tilesUntilMine(i) {
    let number = 0;

    this.minePositions.forEach(element => {
      if (i % 10 == 0) {
        if (this.contactTiles.right.includes(element - i)) {
          number++;
        }
      } else if (i % 10 == 1) {
        if (this.contactTiles.left.includes(element - i)) {
          number++;
        }
      } else {
        if (this.contactTiles.full.includes(element - i)) {
          number++;
        }
      }
    });

    return number;
  }

  checkWin() {
    const correct = this.tiles.filter(tile => tile.flag === true && tile.mine === true).length;
    const open = this.tiles.filter(tile => tile.clicked === true).length;

    if (open == 90 && correct == 10) return true;

    return false;
  }

  generateMinePositions(numberOfMines) {
    let minePositions = [];

    for (let i = 1; i <= numberOfMines; i++) {
      let position = this.randomInteger(1, 100);

      if (minePositions.indexOf(position) !== -1) {
        i--;
        continue;
      } else {
        minePositions.push(position);
      }
    }

    return minePositions;
  }

  randomInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

var config = {
  type: Phaser.AUTO,
  width: 512,
  height: 600,
  scene: [Scene],
  parent: 'game',
};

var game = new Phaser.Game(config);