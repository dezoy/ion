var client = new Client();
var connected = false;
var published = false;
var streams = new Map();

window.onunload = function () {
    client.leave();
}

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
    console.log(stream)
    streams[rid] = stream;
    insertVideoView('remote-video-container', rid);
    stream.render(stream.mid);
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
    var rommEl = document.getElementById('roomId');
    var nameEnt = document.getElementById('nameId');
    let roomId = rommEl.value;
    let nameId = { name: nameEnt.value };
    if (roomId === '')
        return;
    if (nameId.name === '')
        return;
    showStatus('join to [' + roomId + '] ' + nameId.name);
    client.join(roomId, nameId);
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
    let id = stream.uid;
    stream.then((res) => {
        console.log(JSON.stringify(res));
    });
    console.log('stream.uid => '+id);

    insertVideoView('local-video-container', id);
    stream.render(id);
    published = true;
}

client.init();