import './style.css';
import { App } from './app/app';
import { createPlanner } from './app/planner';
import { loadSettings, readUrl } from './app/settings';
import { createStorage } from './app/storage';
import { Sound } from './ui/audio';
import { BoardView } from './ui/board-view';
import { byId } from './ui/dom';
import { Particles } from './ui/particles';

const kv = createStorage();
const settings = loadSettings(kv);

const app = new App({
  view: new BoardView(byId('board'), byId('tray'), byId('scroll')),
  planner: createPlanner(),
  sound: new Sound(settings.muted),
  particles: new Particles(),
  kv,
  settings,
  url: readUrl(location.search),
});

void app.start();
