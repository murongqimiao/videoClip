import React from 'react'
import "./index.css"
import { VideoClip } from "../utils/videoClip"
import "../utils/videoClip.css"


let execTime = 0
let globalPlayer = null
let _videoClip = null

function ctrlPlayer(type, val) {
  if (globalPlayer) {
    switch (type) {
      case 'jump':
        globalPlayer.currentTime(val)
        break;
      case 'volume':
        globalPlayer.mute(!val)
        globalPlayer.volume(val ? 1 : 0)
        break
      case 'play':
        if (val) {
          globalPlayer.play()
        } else {
          globalPlayer.pause()
        }
        break
      case 'destroy':
        globalPlayer.destroy()
        globalPlayer = null
        break
    }
  }
}

function initPlayer(params, toChangeKey) {
  let videoEl = document.getElementById(params.videoId)
  globalPlayer = new window.TCPlayer(videoEl, {
    controls: false,
    volume: 100,
    width: 940, //视频的显示宽度，请尽量使用视频分辨率宽度
    height: 528, //视频的显示高度，请尽量使用视频分辨率高度

    listener: msg => {
      if (msg.type == 'timeupdate') {
        // liveNetCheck.updateTime()
        // if (_videoClip) {
        //   toChangeKey({'currentTime': _videoClip._getTime(_videoClip.previewInfo.currentTime)})
        //   toChangeKey({'realTime': _videoClip._getTime(_videoClip.previewInfo.realTime)})
        //   toChangeKey({'fullTime': _videoClip._getTime(_videoClip.previewInfo.fullTime)})
        // }

        // _videoClip.onPreview(globalPlayer.currentTime(), (handle, time) => {
        //   if (handle === 'playNext') {
        //     ctrlPlayer('jump', time)
        //     // 跳播
        //   } else if (handle === 'playFinish') {
        //     // 停止
        //     ctrlPlayer('play')
        //   }
        // })
      }
    }
  })
  globalPlayer.src(params.url)
}

class VideoEdit extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      value: "", // 用户输入内容
    }
  }

  componentDidMount() {
    console.log("did mount")
    if (!execTime) {
      execTime = 1
      console.log("exec...")
      this.init()
    }
  }

  init () {
    const that = this
    const videoInfo = {
      url: "https://1400310824.vod2.myqcloud.com/d616a221vodtranscq1400310824/a62bf2035285890799943795254/v.f61696.m3u8",
      videoId: "video-edit",
      type: "m3u8",
      src: {}
    }
    console.log('location.hash', window.location.hash)
    if (window.location.hash) {
      videoInfo.url = decodeURIComponent(window.location.hash.split('#')[1])
    }
    videoInfo.src[videoInfo.type] = videoInfo.url

    // 初始化一个用来预览播放的video 
    initPlayer(videoInfo, this.toChangeKey)
    globalPlayer.on('timeupdate', () => {
      console.log("========---------timeupdate-----------")
       if (_videoClip) {
          that.toChangeKey({'currentTime': _videoClip._getTime(_videoClip.previewInfo.currentTime)})
          that.toChangeKey({'realTime': _videoClip._getTime(_videoClip.previewInfo.realTime)})
          that.toChangeKey({'fullTime': _videoClip._getTime(_videoClip.previewInfo.fullTime)})
        }

        _videoClip.onPreview(globalPlayer.currentTime(), (handle, time) => {
          if (handle === 'playNext') {
            ctrlPlayer('jump', time)
            // 跳播
          } else if (handle === 'playFinish') {
            // 停止
            ctrlPlayer('play')
          }
        })
    })
    
    // 初始化编辑区域的video
    _videoClip = new VideoClip({
      src: videoInfo.url, // 视频地址
      showVideo: false,
      el: document.getElementById('video-control'), // 编辑区的dom容器id
      updateCallback: this.whenClipVideoUpdate // 每次裁剪的回调
    })
    _videoClip.init()
  }

  toChangeKey = (value) => {
    this.setState(value)
  }

  whenClipVideoUpdate = () => {
    this.setState({
      canReset: _videoClip && _videoClip.canLastStep(),
      canCancelReset: _videoClip && _videoClip.canResetStep()
    })
  }

  generatePreivew = () => {
    let initTime = _videoClip.getStartTime()
    _videoClip.setPreview(0)
    ctrlPlayer('jump', initTime)
    this.setState({
      playing: true
    }, () => {
      ctrlPlayer('play', true)
    })
  }

  lastStep = () => {
    _videoClip && _videoClip.lastStep()
  }

  reset = () => {
    _videoClip && _videoClip.resetStep()
  }

  back15 = () => {
    let { currentIndex, realTime } = _videoClip.getRealTime(-15)
    if (realTime > 0) {
      _videoClip.previewInfo.currentIndex = currentIndex
      ctrlPlayer('jump', realTime)
    }
  }
  go15 = () => {
    let { currentIndex, realTime } = _videoClip.getRealTime(15)
    if (realTime > 0) {
      _videoClip.previewInfo.currentIndex = currentIndex
      ctrlPlayer('jump', realTime)
    }
  }

  // 视频剪切
  clip = () => {
    if (_videoClip) {
      _videoClip.slipVideo(_videoClip.state.duration)
    }
  }

  play = () => {
    const { playing } = this.state
    this.setState({
      playing: !playing
    }, () => {
      ctrlPlayer('play', !playing)
    })
  }

  inputing = (e) => {
    this.setState({
      value: e.target.value.replace(/[\s]/g, '')
    }, () => {
      console.log('inputing->', this.state.value)
    })
  }

  export = () => {
    let exportResult = _videoClip.state.result.filter(v => !v.delete).map((v, index) => { return { index: index + 1, start: v.start, end: v.end } })
    alert('export result:  ' + JSON.stringify(exportResult))
  }

  reloadPageWidthNewUrl = () => {
    if (!this.state.value) return
    let encodeURL = encodeURIComponent(this.state.value)
    window.location.hash = encodeURL
    window.location.reload()
  }
 

  render () {
    const {
      state: { canReset, canCancelReset, fullTime, currentTime, realTime },
    } = this

    return (
        <div className='video-edit-page'>
          <input type="text" onChange={this.inputing} placeholder='输入视频地址开始编辑'></input>
          <button onClick={this.reloadPageWidthNewUrl}>编辑此视频</button>
          <div className='video-preview-container'>
            <video id='video-edit' style={{ width: '720px' }}></video> 
            <div className="icon-contain">
              <div className="icon left" onClick={this.back15}></div>
              <div className="icon play" onClick={this.play}></div>
              <div className="icon right" onClick={this.go15}></div>
              {
               fullTime ?
                <div className="preview-time">{currentTime + '/' + fullTime + "(真实时间:" + realTime + ")"}</div>
                : null
              }
            </div>
          </div>
          <div id='video-control' style={{position: 'relative'}}></div>

          {/* 加上控制按钮 */}
          <div className="button-area">
            <div className={canReset ? "reset" : "reset disable"} onClick={this.lastStep}>撤回</div>
            <div className={canCancelReset ? "r-reset" : "r-reset disable"} onClick={this.reset}>重做</div>
            <div className={'reset'} onClick={this.clip}>剪切</div>
            <div className={'reset'} onClick={this.generatePreivew}>预览</div>
            <div className={'reset'} onClick={this.export}>导出</div>
          </div>
        </div>
    )
  }
}

export default VideoEdit;
