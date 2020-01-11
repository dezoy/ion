import { EventEmitter } from 'events';
import VideoElement from './VideoElement';

export default class Stream extends EventEmitter {

    constructor(mid = null, stream = null) {
        super();
        this._mid = mid;
        this._stream = stream;
        this._videoElement = new VideoElement();
    }

    async init(sender = false, audio = true, video = true, screen = false) {
        if (sender) {
            if (screen) {
                this._stream = await navigator
                    .mediaDevices
                    .getDisplayMedia({ video: true });
            } else {
                this._stream = await navigator
                    .mediaDevices
                    .getUserMedia({ audio: audio, video: video });
            }
        }
        console.log(this._stream)
    }

    set mid(id) { this._mid = id; }

    get mid() { return this._mid; }

    get stream() { return this._stream };

    render(element) {
        console.log(this._stream)
        console.log(this.stream)
        console.log(stream)
        this._videoElement.play({id: this._mid, stream: this._stream, elementId: element});
    }

    async stop() {
        this._videoElement.stop();
    }
}