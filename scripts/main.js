// Quicksave / Quickload

const SAVE_KEY = KeyCode.f2;
const LOAD_KEY = KeyCode.f3;
const KEY_NAME = String(LOAD_KEY).toUpperCase();
const PREFIX = "hotkey-save-";
const EXT = "msav";
const MAX_SAVES = 10;
const TIMEOUT = 5; // seconds

let saves = []; // savegames
let idx = -1; // savegame index
let active = false; // load-game timeout in progress
let lastPress = 0; // time of last load-key press
let lastToast;

const isSave = n => n.length === PREFIX.length + 14 + 1 + EXT.length && n.indexOf(PREFIX) === 0 && n.slice(-EXT.length) === EXT;
const saveDir = () => Core.settings.getDataDirectory().child("hotkey-saves");
const stamp = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("").filter(c => c >= "0" && c <= "9").join("").slice(0, 14);

function toast(text, seconds) {
    if (lastToast) lastToast.remove();
    Vars.ui.showInfoToast(text, seconds || 3);
    lastToast = Core.scene.root.children.peek();
}

function getSaves() {
    let files = saveDir().list(EXT);
    let out = [];
    for (let i = 0; i < files.length; i++) {
        if (isSave(String(files[i].name()))) out.push(files[i]);
    }
    out.sort((a, b) => String(b.name()).localeCompare(String(a.name())));
    return out.slice(0, MAX_SAVES);
}

function quickSave() {
    if (Vars.net.client()) return toast("[scarlet]Can't save while connected to a server.");
    try {
        let f = saveDir().child(PREFIX + stamp() + "." + EXT);
        f.parent().mkdirs();
        SaveIO.save(f);
        toast("[accent]Saved:[] " + f.name());
    } catch (e) {
        toast("[scarlet]Save failed: " + e);
    }
}

function loadSave(f) {
    Vars.ui.loadAnd(() => {
        try {
            Vars.net.reset();
            SaveIO.load(f);
            Vars.state.rules.editor = false;
            Vars.state.set(GameState.State.playing);
            toast("[accent]Loaded:[] " + f.name());
        } catch (e) {
            Vars.logic.reset();
            Vars.ui.showErrorMessage("Load failed:\n" + e);
        }
    });
}

function onLoadKey() {
    if (Vars.net.active()) return toast("[scarlet]Can't load while online.");
    lastPress = Time.millis();
    if (!active) {
        saves = getSaves();
        if (!saves.length) return toast("[scarlet]No savegames found.");
        active = true;
        idx = -1;
        return toast("[yellow]Press " + KEY_NAME + " again to load a savegame.\nKeep pressing to go further back.", TIMEOUT);
    }
    idx = (idx + 1) % saves.length;
    toast("[yellow]Load:[] " + saves[idx].name() + " (" + (idx + 1) + "/" + saves.length + ")\nPress " + KEY_NAME + " for an older save, or wait to load.", TIMEOUT);
}

Events.run(Trigger.update, () => {
    // If not in game, do nothing
    if (!Vars.state.isGame()) {
        active = false;
        return;
    }

    // If ESC pressed, cancel load-game
    if (active && Core.input.keyTap(KeyCode.escape)) {
        active = false;
        toast("[accent]Load cancelled.");
    }

    // If load-game timeout completes, load gamesave
    if (active && Time.millis() - lastPress > TIMEOUT * 1000) {
        active = false;
        if (idx >= 0) loadSave(saves[idx]);
    }

    // if focus in text field, do nothing
    if (Core.scene.hasField()) return;

    if (Core.input.keyTap(LOAD_KEY))  {
        onLoadKey();
    } else if (Core.input.keyTap(SAVE_KEY)) {
        quickSave();
    }
});
