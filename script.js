const gameState = {
  PLAYING: "PLAYING",
  WIN: "WIN",
  LOST: "LOST"
};

class App {
  state = {};
  tiles = 0;
  minePositions = [];
  excluded = [];
  flags = 10;

  constructor(size) {
    this.tiles = size * size;
    this.minePositions = this.generateMinePositions(10);
    console.log("mine positions", this.minePositions);
  }

  start() {
    document.addEventListener("click", e => {
      if (e.target && e.target.classList.contains("action")) {
        this.run(e.target);
      }
    });

    document.addEventListener("contextmenu", e => {
      if (e.target && e.target.classList.contains("action")) {
        e.preventDefault();
        this.flag(e.target);
      }
    });

    this.generateBoard(10);
  }

  flag(target) {
    if (this.state.state == gameState.LOST) {
      return false;
    }

    if (this.flags <= 0) {
      return false;
    }
    this.state[target.dataset.id]["flag"] = !this.state[target.dataset.id][
      "flag"
    ];

    // const result = this.state.filter(item => item.flag == true);
    // console.log("flags", result.length);

    this.buildHtml();
  }

  generateBoard() {
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

    this.buildHtml();
  }

  run(target) {
    if (this.state.state == gameState.LOST) {
      return false;
    }

    if (this.state[target.dataset.id]["clicked"] === true) {
      return false;
    }

    if (this.state[target.dataset.id]["flag"] === true) {
      return false;
    }

    this.state[target.dataset.id]["clicked"] = true;
    this.updateBoard(target.dataset.id);
    this.buildHtml();
  }

  updateBoard(clickedId) {
    if (this.state[clickedId]["mine"] === true) {
      this.state.state = gameState.LOST;
    }

    this.zeroTiles(clickedId);

    this.buildHtml();
  }

  buildHtml() {
    console.log("Build HTML state", this.state);
    let tableHtml = ``;
    let currentFlags = 0;

    for (let i = 1; i <= this.tiles; i++) {
      let className = "";
      let content = "";
      if (i % 10 == 1) {
        tableHtml = tableHtml + `<tr>`;
      }

      if (this.state[i]["clicked"] === true) {
        className += " clicked";
        if (this.state[i]["close"] !== 0) {
          content = this.state[i]["close"];
        }
      }

      if (
        this.state.state == gameState.LOST &&
        this.state[i]["mine"] === true
      ) {
        className += " mined";
        content = "&#x25CF;";
      }
      if (this.state[i]["flag"] === true) {
        content = "x";
        currentFlags++;
      }

      tableHtml =
        tableHtml +
        `<td id="action" data-id="${i}"" class="action ${className}"> ${content} </td>`;

      if (i % 10 == 0) {
        tableHtml + `</tr>`;
      }
    }

    tableHtml + `</tr>`;

    this.flags = 10 - currentFlags;
    const statsDiv = document.getElementById("stats");
    let win = ``;
    if (this.checkWind()) {
      win = "WIN";
    }
    statsDiv.innerHTML = `flags: ${
      this.flags
    } <span style="color: GREEN; font-size: 20px"> ${win}</span>`;

    const appDiv = document.getElementById("game");
    appDiv.innerHTML = tableHtml;
  }

  checkWind() {
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

  zeroTiles(item) {
    item = parseInt(item);

    this.discoverZeros(item);
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

const app = new App(10);
app.start();
