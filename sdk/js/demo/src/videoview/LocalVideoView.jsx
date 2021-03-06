import React from "react";
import { setTimeout } from "timers";

class LocalVideoView extends React.Component {
  componentDidMount = () => {
    const { stream } = this.props;
    this.video.srcObject = stream.stream;
  };

  render = () => {
    const { id, label } = this.props;
    return (
      <div className="local-video-layout">
        <div className="local-video-container">
          <video
            ref={ref => {
              this.video = ref;
            }}
            id={id}
            autoPlay
            playsInline
            muted={true}
            className="local-video-size"
          />
          <a className="local-video-name">{label}</a>
        </div>
      </div>
    );
  };
}

export default LocalVideoView;
