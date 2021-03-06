import { EventEmitter } from 'events';
import protooClient from 'protoo-client';
import uuidv4 from 'uuid/v4';
import Stream from './Stream';
import * as sdpTransform from 'sdp-transform';

const ices = [
    {
        urls: 'stun:stun.l.google.com:19302'
    },{
        urls: 'turn:185.137.233.49:3478',
        username: '123qwe',
        credential: 'ewq321'
    },{
        urls: 'turn:185.143.172.77:3478',
        username: 'user1',
        credential: 'pass1'
    },
];
var log = msg => {
    console.log(msg)
}
const DefaultPayloadTypePCMU = 0;
const DefaultPayloadTypePCMA = 8;
const DefaultPayloadTypeG722 = 9;
const DefaultPayloadTypeOpus = 111;
const DefaultPayloadTypeVP8 = 96;
const DefaultPayloadTypeVP9 = 98;
const DefaultPayloadTypeH264 = 102;

export default class Client extends EventEmitter {

    constructor() {
        super();
        this._port = 8443;
        this._uid = uuidv4();
        this._pcs = new Map();
        this._streams = new Map();
    }

    get uid() {
        return this._uid;
    }

    init() {
        this._url = this._getProtooUrl(this._uid);

        let transport = new protooClient.WebSocketTransport(this._url);
        this._protoo = new protooClient.Peer(transport);

        this._protoo.on('open', () => {
            console.log('Peer "open" event');
            this.emit('transport-open');
        });

        this._protoo.on('disconnected', () => {
            console.log('Peer "disconnected" event');
            this.emit('transport-failed');
        });

        this._protoo.on('close', () => {
            console.log('Peer "close" event');
            this.emit('transport-closed');
        });

        this._protoo.on('request', this._handleRequest.bind(this));
        this._protoo.on('notification', this._handleNotification.bind(this));
    }

    async join(roomId, info) {
        this._rid = roomId;
        
        try {
            let data = await this
                ._protoo
                .request('join', {'rid': this._rid, 'uid': this._uid, 'info': info})
            console.log('join success: result => ' + JSON.stringify(data))
            return data
        } catch (error) {
            console.log('join reject: error =>' + error);
        }
    }

    async leave() {
        try {
            let data = await this
                ._protoo
                .request('leave', {'rid': this._rid, 'uid': this._uid});
            console.log('leave success: result => ' + JSON.stringify(data));
            return data;
        } catch (error) {
            console.log('leave reject: error =>' + error);
        }
    }

    async publish(options = { audio: true, video: true, screen: false, codec: 'vp9' }) {
        console.log('publish options => %o', options);
        var promise = new Promise(async (resolve, reject) => {
            try {
                let stream = new Stream();
                await stream.init(true, options.audio, options.video, options.screen);
                let pc = await this._createSender(stream.stream);

                pc.onicecandidate = async (e) => {
                    if (e.candidate) {
                    // if (!pc.sendOffer) {
                        pc.sendOffer = true
                        let jsep = pc.localDescription;                        
                        let result = await this
                            ._protoo
                            .request('publish', { 'rid': this._rid, 'jsep': jsep, 'options': options})
                            
                        await pc.setRemoteDescription(
                                new RTCSessionDescription(result.jsep)
                            )
                        console.log('publish success => ' + typeof result )
                        stream.mid = result.mid
                        this._pcs[stream.mid] = pc
                        resolve(stream);
                    }
                }
                let offer = await pc.createOffer({
                        offerToReceiveVideo: false, 
                        offerToReceiveAudio: false 
                    })
                let desc = this._payloadModify(offer, options.codec);
                await pc.setLocalDescription(desc);
            } catch (error) {
                console.log('publish request error  => ' + error);
                // pc.close();
                reject(error);
            }
        });
        return promise;
    }

    async unpublish(mid) {
        console.log('unpublish rid => %s, mid => %s', this._rid, mid);
        this._removePC(mid);
        try {
            let data = await this
                ._protoo
                .request('unpublish', { rid: this._rid, mid });
            console.log('unpublish success: result => ' + JSON.stringify(data));
            return data;
        } catch (error) {
            console.log('unpublish reject: error =>' + error);
        }
    }

    async subscribe(rid, mid) {
        console.log('subscribe rid => %s, mid => %s', rid, mid);
        var promise = new Promise(async (resolve, reject) => {
            try {
                let pc = await this._createReceiver(mid);
                pc.onaddstream = (stream) => {
                // pc.onaddtrack = (e) => {
                    // let stream = streams[0]
                    console.log('Stream::pc::onaddstream', stream.id);
                    resolve(new Stream(mid, stream));
                }
                pc.onremovestream = (stream) => {
                // pc.onremovetrack = (e) => {
                    // let stream = streams[0]
                    console.log('Stream::pc::onremovestream', stream.id);
                }
                pc.onicecandidate = async (e) => {
                    // Send the candidate to the remote peer
                    if (e.candidate) {
                    // if (!pc.sendOffer) {
                        var jsep = pc.localDescription;
                        // console.log('Send offer sdp => ' + jsep.sdp);
                        pc.sendOffer = true
                        let result = await this
                            ._protoo
                            .request('subscribe', {'rid': rid, 'jsep': jsep, 'mid': mid});

                        let sdpParsed = sdpTransform.parse(result.jsep.sdp)
                        console.log('subscribe success => result(' + mid + ') sdp => ' + JSON.stringify(sdpParsed) );
                        await pc.setRemoteDescription(
                                new RTCSessionDescription(result.jsep)
                            );
                    } else {
                        // All ICE candidates have been sent
                    }
                }
                let offer = await pc.createOffer({
                        offerToReceiveVideo: true, 
                        offerToReceiveAudio: true
                    })
                await pc.setLocalDescription(offer);
                this._pcs[mid] = pc;
            } catch (error) {
                console.log('subscribe request error  => ' + error);
                reject(error);
            }
        });
        return promise;
    }

    async unsubscribe(rid, mid) {
        try {
            let data = await this
                ._protoo
                .request('unsubscribe', { 'rid': rid, 'mid': mid });

            console.log('unsubscribe success: result => ' + JSON.stringify(data));
            this._removePC(mid);
        } catch (error) {
            console.log('unsubscribe reject: error =>' + error);
        }
    }

    close() {
        this._protoo.close();
    }

    _payloadModify(desc, codec) {

        if (codec === undefined)
            return desc;

        /*
         * DefaultPayloadTypePCMU = 0
         * DefaultPayloadTypePCMA = 8
         * DefaultPayloadTypeG722 = 9
         * DefaultPayloadTypeOpus = 111
         * DefaultPayloadTypeVP8  = 96
         * DefaultPayloadTypeVP9  = 98
         * DefaultPayloadTypeH264 = 102
        */
        let payload;
        let codeName = '';
        const session = sdpTransform.parse(desc.sdp);
        console.log('SDP object => %o', session);
        var videoIdx = -1;
        session['media'].map((m, index) => {
            if (m.type == 'video') {
                videoIdx = index;
            }
        });

        if (videoIdx == -1) return desc;

        if (codec.toLowerCase() === 'vp8') {
            payload = DefaultPayloadTypeVP8;
            codeName = "VP8";
        } else if (codec.toLowerCase() === 'vp9') {
            payload = DefaultPayloadTypeVP9;
            codeName = "VP9";
        } else if (codec.toLowerCase() === 'h264') {
            payload = DefaultPayloadTypeH264;
            codeName = "H264";
        } else {
            return desc;
        }

        console.log('Setup codec => ' + codeName + ', payload => ' + payload);

        var rtp = [
            { "payload": payload, "codec": codeName, "rate": 90000, "encoding": null },
            { "payload": 97, "codec": "rtx", "rate": 90000, "encoding": null }
        ];

        session['media'][videoIdx]["payloads"] = payload + " 97";
        session['media'][videoIdx]["rtp"] = rtp;

        var fmtp = [
            { "payload": 97, "config": "apt=" + payload }
        ];

        session['media'][videoIdx]["fmtp"] = fmtp;

        var rtcpFB = [
            { "payload": payload, "type": "transport-cc", "subtype": null },
            { "payload": payload, "type": "ccm", "subtype": "fir" },
            { "payload": payload, "type": "nack", "subtype": null },
            { "payload": payload, "type": "nack", "subtype": "pli" }
        ];
        session['media'][videoIdx]["rtcpFb"] = rtcpFB;

        let tmp = desc;
        tmp.sdp = sdpTransform.write(session);
        return tmp;
    }

    async _createSender(stream) {
        let pc = new RTCPeerConnection({ iceServers: ices });
        pc.sendOffer = false;
        // pc.addStream(stream);
        for (const track of stream.getTracks() ) {
            pc.addTrack(track, stream);
        }
        return pc;
    }

    async _createReceiver(mid) {
        // log('create receiver => ' + mid);
        let pc = new RTCPeerConnection({iceServers: ices});
        pc.sendOffer = false;
        // pc.addTransceiver('audio', { 'direction': 'recvonly' });
        // pc.addTransceiver('video', { 'direction': 'recvonly' });
        // await pc.createOffer()
        //     .then(d => pc.setLocalDescription(d))
        //     .catch(log);
        
        this._pcs[mid] = pc;
        return pc;
    }

    _removePC(id) {
        let pc = this._pcs[id];
        if (pc) {
            console.log('remove pc mid => %s', id);
            pc.close();
            delete this._pcs[id];
        }
    }

    _getProtooUrl(pid) {
        const hostname = window.location.hostname;
        let url = `wss://${hostname}:${this._port}/ws?peer=${pid}`;
        return url;
    }

    _handleRequest(request, accept, reject) {
        console.log('Handle request from server: [method:%s, data:%o]', request.method, request.data);
    }

    _handleNotification(notification) {
        const { method, data } = notification;
        console.log('Handle notification from server: [method:%s, data:%o]', method, data);
        switch (method) {
            case 'peer-join':
                {
                    const { rid, uid, info } = data;
                    console.log('peer-join peer rid => %s, id => %s, info => %o', rid, uid, info);
                    this.emit('peer-join', rid, uid, info);
                    break;
                }
            case 'peer-leave':
                {
                    const { rid, uid } = data;
                    console.log('peer-leave peer rid => %s, id => %s', rid, uid);
                    this.emit('peer-leave', rid, uid);
                    break;
                }
            case 'stream-add':
                {
                    const { rid, mid, info } = data;
                    console.log('stream-add peer rid => %s, mid => %s, info => %s', rid, mid);
                    this.emit('stream-add', rid, mid, info);
                    break;
                }
            case 'stream-remove':
                {
                    const { rid, mid } = data;
                    console.log('stream-remove peer rid => %s, mid => %s', rid, mid);
                    this.emit('stream-remove', rid, mid);
                    this._removePC(mid);
                    break;
                }
        }
    }
}
