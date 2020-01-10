var client = new Client();
var connected = false;
var published = false;
var stream_id = false;
var streams = new Map();

window.onunload = function () {
    client.leave();
}
window.onunload = async () => {
    await this._cleanUp();
};
_cleanUp = async () => {
    await client.leave();
};
client.on('peer-join', (id, rid) => {
    showStatus('peer => ' + id + ', join!');
});

client.on('peer-leave', (id, rid) => {
    showStatus('peer => ' + id + ', leave!');
});

client.on('transport-open', function () {
    showStatus('transport open!');
    connected = true;
});

client.on('transport-closed', function () {
    showStatus('transport closed!');
    connected = false;
});

client.on('stream-add', async (rid, mid) => {
    let stream = await client.subscribe(rid, mid);
    streams[rid] = stream;
    insertVideoView('remote-video-container', rid);
    stream.render(rid);
    // stream.render(stream.uid); //old
});

client.on('stream-remove', async (rid) => {
    let stream = streams[rid];
    removeVideoView(rid);
    stream.stop();
    delete streams[rid];
});

function insertVideoView(parentId, id) {
    let parentNode = document.getElementById(parentId);
    let element = document.createElement("div");
    element.id = id;
    parentNode.appendChild(element);
}

function removeVideoView(id) {
    let element = document.getElementById(id);
    element.parentNode.removeChild(element);
}

function showStatus(text) {
    var element = document.getElementById('status');
    element.value = text;
    console.log(text);
}

function onJoinBtnClick() {
    var roomEl = document.getElementById('roomId');
    var nameEnt = document.getElementById('nameId');
    let roomId = roomEl.value;
    let nameId = { name: nameEnt.value };
    if (roomId === '')
        return;
    if (nameId.name === '')
        return;
    showStatus('join to [' + roomId + '] ' + nameId.name);
    client.join(roomId, nameId);
    document.getElementById('join_btn').setAttribute("disabled", "disabled");
    document.getElementById('leave_btn').removeAttribute("disabled");
}

function onLeaveBtnClick() {
    var roomEl = document.getElementById('roomId');
    var nameEnt = document.getElementById('nameId');
    let roomId = roomEl.value;
    let nameId = { name: nameEnt.value };
    showStatus('leave [' + roomId + '] ' + nameId.name);
    _cleanUp()
    document.getElementById('join_btn').removeAttribute("disabled");
    document.getElementById('leave_btn').setAttribute("disabled", "disabled");
}

async function onPublishBtnClick() {
    if (!connected) {
        alert('not connected to the server!');
        return;
    }
    if (published) {
        alert('already published!');
        return;
    }
    showStatus('start publish!');
    let stream = await client.publish(/*{ codec: 'H264' }*/);
    stream_id = stream.mid;
    console.log(stream);
    console.log('stream.uid => ' + stream_id);

    insertVideoView('local-video-container', stream_id);
    stream.render(stream_id);
    published = true;

    document.getElementById('publish_btn').removeAttribute("disabled");
    document.getElementById('unpublish_btn').setAttribute("disabled", true);
}
async function onUnPublishBtnClick() {
    if ( ! connected) {
        alert('not connected to the server!');
        return;
    }
    if ( ! published) {
        alert('not published!');
        return;
    }
    showStatus('unpublish');
    await client.unpublish();

    removeVideoView(stream_id)
    published = false;

    document.getElementById('unpublish_btn').setAttribute("disabled", true);
    document.getElementById('publish_btn').removeAttribute("disabled");
}

client.init();