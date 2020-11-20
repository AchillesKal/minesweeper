
      const gameState = {
        PLAYING: "PLAYING",
        WIN: "WIN",
        LOST: "LOST"
      };

      class Scene extends Phaser.Scene {
        state = {};
        tiles = 100;
        minePositions = [];
        excluded = [];
        flags = 10;
        flagtext = "";

        constructor() {
          super();
          this.minePositions = this.generateMinePositions(10);
        }

        draw() {
          let x = 200;
          let y = 100;
          let change = 26;
          let currentFlags = "";

          for (let i = 1; i <= this.tiles; i++) {

            if (this.state[i]["clicked"] === true) {
              this.add.image(x, y, 'gray-tile')
              if (this.state[i]["close"] !== 0) {
                this.add.text(x-4, y-7, this.state[i]["close"],{fill: "#000", align: "center"});
              } 
              
            } else {
              this.add.image(x, y, 'white-tile')
              .setInteractive()
              .on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, 
                (pointer) => {
                  if (this.state.state == gameState.LOST) {
                    return false;
                  }

                  if( this.state.state == gameState.WIN){
                    return false;
                  }

                  if( pointer.button == 0) {
                      
                    if (this.state[i]["clicked"] === true) {
                      return false;
                    }

                    if (this.state[i]["flag"] === true) {
                      return false;
                    }

                    if (this.state[i]["mine"] === true) {
                      this.state.state = gameState.LOST;
                    }

                    this.zeroTiles(i);

                    this.state[i]["clicked"] = true;

                  } else if(pointer.button == 2) {
                    if (this.state[i]["clicked"] === true) {
                      return false;
                    }
                   
                    if (this.flags <= 0 &&  !this.state[i]["flag"] == true) {
                      return false;
                    }

                    this.state[i]["flag"] = !this.state[i][
                      "flag"
                    ];
                  }
                  
                  this.draw();
                }
              );
            }

            if (
              this.state.state == gameState.LOST &&
              this.state[i]["mine"] === true
            ) {
              this.add.image(x, y, 'mine-tile')
            }
            if (this.state[i]["flag"] === true) {
              this.add.image(x, y, 'banner')
              currentFlags++;
            }
            x = x + change;

            // Change row.
            if(i % 10 == 0) {
              y = y + change;
              x = 200;
            }

          }

          this.flags = 10 - currentFlags;

          if(this.flagtext !== "") {
            this.flagtext.setVisible(false);
          }

          this.flagtext = this.add.text(10, 10, "Flags: " + this.flags,{fill: "#FFF", align: "center"});
          
          if (this.checkWin()) {
            this.state.state = gameState.WIN;
            this.add.text(10, 30, "YOU WON",{fill: "#FFF", align: "center"});
          }

          if(this.state.state == gameState.LOST) {
            this.add.text(10, 30, "YOU LOST",{fill: "#FFF", align: "center"});
          }

        const clickButton = this.add.text(10, 50, 'Restart', { fill: '#0f0' })
            .setInteractive()
            .on('pointerdown', () => {
            this.scene.restart();
        })

          
          
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
          this.state.state = gameState.PLAYING;
          for (let i = 1; i <= this.tiles; i++) {
            this.state[i] = {};

            if (this.minePositions.indexOf(i) !== -1) {
              this.state[i]["mine"] = true;
            }
            
          }

          for (let i = 1; i <= this.tiles; i++) {
            let number = this.tilesUnitMine(i);
            this.state[i]["close"] = number;
          }
          this.draw();     
        }

        update ()
        {
        }

        discoverZeros(item) {
          let rightSide = [-1, -10, -11, 10, 9];
          let leftSide = [1, 10, 11, -10, -9];
          let general = [1, 10, 11, -1, -10, -11, -9, 9];
          let positionsToOpen = [];

          if (item % 10 == 0) {
            rightSide.forEach(element => {
              if (element + item < 100 && element + item > 1) {
                if (this.state[item].close === 0 && this.state[item].mine !== true) {
                  positionsToOpen.push(element + item);
                }
              }
            });
          } else if (item % 10 == 1) {
            leftSide.forEach(element => {
              if (element + item <= 100 && element + item >= 1) {
                if (this.state[item].close === 0 && this.state[item].mine !== true) {
                  positionsToOpen.push(element + item);
                }
              }
            });
          } else {
            general.forEach(element => {
              if (element + item <= 100 && element + item >= 1) {
                if (this.state[item].close === 0 && this.state[item].mine !== true) {
                  positionsToOpen.push(element + item);
                }
              }
            });
          }

          positionsToOpen.forEach(element => {
            if (this.state[element].clicked !== true) {
              this.state[element].clicked = true;
              this.state[element]["flag"] = false;
              this.discoverZeros(element);
            }
          });

          if (positionsToOpen.length == 0) {
            return false;
          }

          return positionsToOpen;
        }

        tilesUnitMine(i) {
          let number = 0;

          this.minePositions.forEach(element => {
            if (i % 10 == 0) {
              if (
                element - i == -1 ||
                element - i == -10 ||
                element - i == -11 ||
                element - i == 10 ||
                element - i == 9
              ) {
                number++;
              }
            } else if (i % 10 == 1) {
              if (
                element - i == 1 ||
                element - i == 10 ||
                element - i == 11 ||
                element - i == -10 ||
                element - i == -9
              ) {
                number++;
              }
            } else {
              if (
                element - i == 1 ||
                element - i == 10 ||
                element - i == 11 ||
                element - i == -1 ||
                element - i == -10 ||
                element - i == -11 ||
                element - i == -9 ||
                element - i == 9
              ) {
                number++;
              }
            }
          });

          return number;
        }

        checkWin() {
          let clicked = 0;
          let correct = 0;
          for (let i = 1; i <= this.tiles; i++) {
            if (this.state[i]["clicked"] === true) {
              clicked++;
            }

            if (this.state[i]["flag"] === true && this.state[i]["mine"] === true) {
              correct++;
            }
          }

          if (clicked == 90 && correct == 10) return true;

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
          width: 800,
          height: 600,
          scene: [Scene]
      };

      var game = new Phaser.Game(config);