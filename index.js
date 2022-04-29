import throttle from 'loadsh/throttle'
export class VideoClip {
    blindVideo = null
    seekedTime = 0
    controlUI = null
    drag = false // 是否可以移动光标
    seeking = false // 正在生成截图 
    curPreviewSrc = ''
    scrollHideAreaWidth = 0 // 记录滚动条位置,忽略
    snapBuffer = { // 展示过的加个缓冲

    }
    initMouseMovePosition = { // 记录mousedown行为的初始位置
        clientX: 0,
        slideBarLeft: 0,
        ts: 0,
    }
    previewInfo = { // 预览信息
        currentTime: 0, // 当前播放的回归后时间(展示时间)
        realTime: 0,
        fullTime: 0,
        currentIndex: 0,
    }
    store = { // 用来做撤回相关
        step: -1, // 指针,标注当前在第几个步骤
        save: [],
    }
    // 状态数据
    state = {
        el: null,
        noUI: true,
        result: [],
        initSnapNumber: 4, // 初始时候展示多少张图片(除首位两张以外)
        videoSrc: null,
        videoWidth: 280,
        videoHeight: 160,
        blindVideoElId: 'blind-video-container-private',
        videoListId: 'clip-videos-list-container',
        showVideo: false,
        duration: 0,
        fullTime: 0,
        updateCallback: null
    }
    constructor(props) {
        const { el = null, noUI = false, result = [], initSnapNumber = 4, src = '', showVideo = false, other = {}, updateCallback } = props
        this.state = {
            ...this.state,
            el,
            noUI,
            result,
            videoSrc: src,
            showVideo,
            updateCallback,
            ...other
        }
    }
    getResult = () => {
        return this.state.result
    }
    init = () => {
        // 检查是否存在TCPlayer
        if (!this._checkTcPlayer()) {
            console.error("=======Video Clip init fail========")
            console.error("=======there is no TCPlayer in window==========")
            return false
        }
       
        // 初始化一个透明静音的video
        this._generateBlindVideo()
        this._initBlindVideo()
        // 检查是否需要UI
        if (this._checkNeedUI()) {
            // UI相关准备
            this._generateUI()
        } 
    }
    getDuration = function() {
        return this.state.duration;
    }

    getScreenByTs = throttle((time, cb) => {
        this._getScreenByTs(time)
        .then(res => {
            cb && cb(this._screenshotVideo())
        })
        .catch(err => {
            cb && cb("err")
        })
    }, 300)

    _screenshotVideo = () => {
        const videoEl = document.querySelector(`#${this.state.blindVideoElId} video`)
        let _canvas = document.createElement('canvas')
        _canvas.width = this.state.videoWidth
        _canvas.height = this.state.videoHeight
        let ctx = _canvas.getContext('2d')
        ctx.drawImage(videoEl, 0, 0, _canvas.width, _canvas.height)
        let _screen = _canvas.toDataURL()
        return _screen
    }

    _getScreenByTs = (time) => {
        return new Promise((resolve, reject) => {
            const _seekedTime = this.seekedTime
            const videoEl = document.querySelector(`#${this.state.blindVideoElId} video`)
            if (videoEl) { videoEl.currentTime = Number(time) }
            let exec = true
            // 超时逻辑
            setTimeout(() => {
                exec = false
                this.seeking = false
                reject('超时...')
            }, 5000)
            // 持续监听seeked变化
            let listenSeekedTimeChange = () => {
                if (this.seekedTime > _seekedTime) {
                    // 跳转视频time完成, 开始截图
                    this.seeking = false
                    resolve(this.seekedTime)
                } else {
                    exec && window.requestAnimationFrame(listenSeekedTimeChange)
                }
            }
            this.seeking = true
            listenSeekedTimeChange()
        })
    }
    _checkTcPlayer = () => {
        return window && window.TCPlayer
    }
    _checkNeedUI = () => {
        return !this.state.noUI
    }
    _generateUI = () => {
        const el = this.state.el
        const _contain = document.createElement('div')
        _contain.className = 'video-clip-scaleplate-container'
        _contain.style.width = '100%'
        _contain.style.display = 'relative'
        el.appendChild(_contain)
       const _startTag = document.createElement('div')
       const _endTag = document.createElement('div')
       const _scaleplate = document.createElement('div')
       _startTag.className = 'start-tag'
       _scaleplate.className = 'scale-plate'
       _endTag.className = 'end-tag'
       _startTag.innerHTML = this._getTime(0)
       _endTag.innerHTML = this._getTime(this.state.duration)
       _contain.appendChild(_startTag)
       _contain.appendChild(_scaleplate)
       _contain.appendChild(_endTag)


       // add slide bar
       const _slideBar = document.createElement('div')
       _slideBar.className = "clip-slide-bar"
       _scaleplate.appendChild(_slideBar)

       // add event listener
       _slideBar.addEventListener("mousedown", (e) => {
           this.drag = true
           this.initMouseMovePosition = {
                clientX: e.clientX,
                slideBarLeft: _slideBar.style.left.split("px")[0] || 0,
                ts: + new Date()
           }
        //    console.log("mousedown", e)
       })
       this.state.el.addEventListener("mouseup", () => {
           this.drag = false
       })
       this.state.el.addEventListener("mouseleave", () => {
           this.drag = false 
       })
       this.state.el.addEventListener("mousemove", (e) => {
           if (this.drag) {
            let _cur = (e.clientX - this.initMouseMovePosition.clientX) + Number(this.initMouseMovePosition.slideBarLeft)
            if (_cur < 0 || _cur > _contain.offsetWidth) {
               return
            }
            _slideBar.style.left = _cur + 'px'
            // 打印当前的视频百分比
            if (this.noUI) { // 不需要UI支持时,根据容器宽度作为100%视频长度
                const _max = _contain.offsetWidth
                const percent = Number((_cur * 100/_max).toFixed(2))
                const time = Number((percent * this.state.fullTime / 100).toFixed(2))
                this._startTag(time)
                this.state.duration = time
                this._setLoading(true)
                this.getScreenByTs(this.state.duration,  (res) => {
                    this._setLoading(false)
                    // console.log("seeked", res)
                    this._setPreview(res)
                })
            } else {
                /**
                 * 回归计算视频的真实时间,相对麻烦一些, 需要考虑红色针所在的位置, 计算offset 红色指针, 再计算隐藏区域的宽度, 相加
                 *                               指针
                 *  ┏━━━━━━━━━━━━━━━━━━━┓┃┏━━━━━━━┃━━━━━━━━━━━━┓
                 *  ┃ scroll hide area  ┃┃┃ video ┃  visible   ┃
                 *  ┗━━━━━━━━━━━━━━━━━━━┛┃┗━━━━━━━┃━━━━━━━━━━━━┛
                 *  author by murongqimiao@live.cn 有问题可以沟通
                 */
                const scrollHideAreaWidth = document.getElementById(this.state.videoListId).scrollLeft
                const clipSlideBarEll = document.querySelector('.clip-slide-bar')
                if ((!scrollHideAreaWidth && scrollHideAreaWidth !== 0) || !clipSlideBarEll) {
                   return
                }
                let pointerVariation = Number(clipSlideBarEll.style.left.split('px')[0])
                let videoVariation = Math.floor(pointerVariation + scrollHideAreaWidth)
                // 根据偏移量寻找划在哪段视频上
                let findVideoActiveInfo = {
                    activeIndex: null,
                    timeSum: 0,
                }
                let videoClips = document.querySelectorAll('.video-clip-each')
                videoClips.forEach((videoClipEl, index) => {
                    const { start, end } = this.state.result[index]
                    let cssStart = videoClipEl.offsetLeft
                    let cssEnd = videoClipEl.offsetLeft + videoClipEl.offsetWidth
                    if (videoVariation >= cssStart && videoVariation <= cssEnd) {
                        // 找到活跃的视频区域
                        findVideoActiveInfo.activeIndex = index
                        // 计算在此区间内移动的范围
                        const playedDistences = (videoVariation - cssStart)
                        const curentAreaPlayedTime = Math.round((playedDistences / videoClipEl.offsetWidth) * (end - start) * 100) / 100
                        const playedTime = curentAreaPlayedTime + start

                        this._startTag(findVideoActiveInfo.timeSum + curentAreaPlayedTime)
                        this.state.duration = playedTime
                        this._setLoading(true)

                        this.getScreenByTs(playedTime,  (res) => {
                            this._setLoading(false)
                            // console.log("seeked", res)
                            this._setPreview(res)
                        })
                    } else {
                        if (!this.state.result[index].delete) {
                            findVideoActiveInfo.timeSum += (end - start)
                        }
                    }
                })
                
            }
            
           }
       })
    }
    _getTime = (n) => {
        let minutes = `00`
        let seconds = `00`
        let floor60 = Math.floor(n / 60)
        let remained60 = Math.floor(n % 60)
        minutes = floor60 > 9 ? floor60 : '0' + floor60
        seconds = remained60 > 9 ? remained60 : '0' + remained60
        return `${minutes}:${seconds}`
    }
    _generateBlindVideo = () => {
        const { blindVideoElId } = this.state;
        if (document.getElementById(blindVideoElId)) {
            return document.getElementById(blindVideoElId)
        } else {
            const _blindVideoContainer = document.createElement('video')
            _blindVideoContainer.id = blindVideoElId
            _blindVideoContainer.style.width = '940px'
            _blindVideoContainer.style.height = '528px'
            _blindVideoContainer.style.zIndex = '-999'
            if (!this.state.showVideo) {
                _blindVideoContainer.style.opacity = '0'
                _blindVideoContainer.style.pointerEvents = 'none'
            }
            document.body.appendChild(_blindVideoContainer)
            return _blindVideoContainer
        }
    }
    _removeBlindVideo = () => {
        const { blindVideoElId } = this.state;
        const _blindVideoContainer = document.getElementById(blindVideoElId)
        _blindVideoContainer && document.body.removeChild(_blindVideoContainer)
    }
    // 初始化提取截图的视频容器
    _initBlindVideo = () => {
        const that = this;
        const blindVideoEl = document.getElementById(this.state.blindVideoElId)
        this.blindVideo = new window.TCPlayer(blindVideoEl, {
            ...this.state.videoSrc,
            autoplay: false,
            live: false,
            controls: true,
            volume: 0,
            width: that.state.videoWidth, //视频的显示宽度，请尽量使用视频分辨率宽度
            height: that.state.videoHeight, //视频的显示高度，请尽量使用视频分辨率高度
        })
        this.blindVideo.on('seeked', () => {
            that.seekedTime++
        })
        this.blindVideo.on('loadedmetadata', () => {
            that.state.fullTime = this.blindVideo.duration()
            that._setEndTag(that.state.fullTime)
            // 视频的元数据加载完成 只会执行一次
            let { result } = that.state
            if (!result.length) {
                let resultData = [{
                    start: 0,
                    end: that.state.fullTime,
                    content: '',
                    startPic: '',
                    endPic: '',
                }]
                that.addStep(resultData)
                result = that.state.result
            // 先加入4个缓冲的图片, 丰富分段内容
            let sectionLong = Math.floor((result[0].end - result[0].start) / 5)
            const extraSnapList = []
            for (let i = 1; i <= this.state.initSnapNumber; i++) {
                extraSnapList.push({
                    time: that.state.result[0].start + (sectionLong * i) + "",
                    cb: function() {
                        that.snapBuffer[that.state.result[0].start + (sectionLong * i) + ""] = that._screenshotVideo()
                    }
                })
            }

            let waitSnapList = [].concat(extraSnapList, [{
                    time: result[0].start,
                    cb: function() {
                        that.state.result[0].startPic = that._screenshotVideo()
                    }
                }, {
                    time: result[0].end,
                    cb: function() {
                        that.state.result[0].endPic = that._screenshotVideo()
                        if (that._checkNeedUI())  {
                            that._generateVideoPieces()
                        }
                        that.setPreview()
                    }
                }])
                that._initBlindVideoScreenSnap(waitSnapList)
            }
        })
        this.blindVideo.src(this.state.videoSrc)
    }
    _initBlindVideoScreenSnap = async (waitSnapList) => {
        if (waitSnapList && waitSnapList.length) {
            while (waitSnapList && waitSnapList.length) {
                let time = waitSnapList[0].time
                try {
                    await this._getScreenByTs(Number(time))
                    waitSnapList[0].cb && waitSnapList[0].cb()
                    waitSnapList.shift()
                } catch (err) {
                    console.log("过大视频存在超时风险", err)
                }
              
            }
        }
    }
    // 设置结束时间的展示
    _setEndTag = (time) => {
        if (document.querySelector('.end-tag')) {
            document.querySelector('.end-tag').innerHTML = (this._getTime(time))
        }
    }
    // 设置开始时间的展示
    _startTag = (time) => {
        if (document.querySelector('.start-tag')) {
            document.querySelector('.start-tag').innerHTML = (this._getTime(time))
        }
    }
    // 设置预览的图片
    _setPreview = (src) => {
        const that = this
        const slideBar = document.querySelector('.clip-slide-bar')
        this.curPreviewSrc = src
        if (slideBar) {
            if (document.querySelector('.clip-slide-bar .clip-preview-img img')) {
                document.querySelector('.clip-slide-bar .clip-preview-img img').src = src
            } else {
                let clipPreivew = document.createElement('div')
                clipPreivew.className = 'clip-preview-img'
                let _img = document.createElement('img')
                _img.src = src
                slideBar.appendChild(clipPreivew)
                clipPreivew.appendChild(_img)
                // console.log("clipPreivew", clipPreivew)
                clipPreivew.onclick = function (e) {
                    let now = +new Date()
                    if (now - that.initMouseMovePosition.ts < 300) {
                        that.slipVideo(that.state.duration)
                        // 短点击按照切割计算
                    }
                }
            }
        }
    }
    // showLoading
    _setLoading = (flag) => {
        let newClass = flag ? 'clip-img-loading' : 'clip-img-no-loading'
        let oldClass = flag ? 'clip-img-no-loading' : 'clip-img-loading'
        const clipPreviewImgEl = document.querySelector('.clip-slide-bar .clip-preview-img')
        if (!clipPreviewImgEl) {
            try {
                this._setPreview(this.state.result[0].startPic)
            } catch (err) { console.log("err", err) }
        } else {
            if (clipPreviewImgEl.classList.contains(oldClass)) {
                clipPreviewImgEl.classList.replace(oldClass, newClass)
            } else {
                clipPreviewImgEl.classList.add(newClass)
            }
        }
    }
    // 加载切割后的视频展示
    _generateVideoPieces = () => {
        const containerId = this.state.videoListId
        const brotherClass = 'video-clip-scaleplate-container'
        let containerEl = document.createElement('div')
        containerEl.id = containerId
        if (!document.querySelector(`.${brotherClass}`)) return
        let fatherCotaniner = document.querySelector(`.${brotherClass}`).parentElement
        if (!document.getElementById(containerId)) { // 追加一个容器
            fatherCotaniner.appendChild(containerEl)
        } else {
            document.querySelector(`#${containerId}`).remove()
            fatherCotaniner.appendChild(containerEl)
        }
        // 清空容器内全部元素
        this.state.result.forEach(item => {
            let eachVideoEl = document.createElement('div')
            eachVideoEl.className = 'video-clip-each'
            if (item.delete) {
                eachVideoEl.classList.add('is-delete')
            }
            let startScreenEl = document.createElement('img')
            startScreenEl.src = item.startPic
            let endScreenEl = document.createElement('img')
            endScreenEl.src = item.endPic
            const htmlText = `<div class="handle-btn">
                <div>左移</div>
                <div>${item.delete ? '恢复' : '删除'}</div>
                <div>右移</div>
            </div>`
            if (this.state.result.length > 1) { eachVideoEl.innerHTML = htmlText }
            eachVideoEl.appendChild(startScreenEl)
            // 此处添加snap buffer的存储图片,如果是在区间内, 则增加渲染的图片数量
            Object.keys(this.snapBuffer).sort((a, b) => a - b).forEach(t => {
                if (item.start < Number(t) && Number(t) < item.end) {
                    let snapImg = document.createElement('img')
                    snapImg.src = this.snapBuffer[t]
                    eachVideoEl.appendChild(snapImg)
                }
            })
            // console.log(Object.keys(this.snapBuffer).sort((a, b) => a - b))
            eachVideoEl.appendChild(endScreenEl)
            containerEl.appendChild(eachVideoEl)
            let handleBtnEls = document.querySelectorAll('.video-clip-each .handle-btn')
            for (let i = 0; i < handleBtnEls.length; i++) {
                handleBtnEls[i].children[0].onclick = () => { this.changeVideo('left', i) };
                handleBtnEls[i].children[1].onclick = () => { this.changeVideo('remove', i) };
                handleBtnEls[i].children[2].onclick = () => { this.changeVideo('right', i) };
            }
        })
        // 恢复滚动条位置
        if (this.scrollHideAreaWidth) {
            try {
                let scrollArea = document.getElementById(this.state.videoListId)
                // console.log(scrollArea, this.scrollHideAreaWidth)
                scrollArea.scrollTo(this.scrollHideAreaWidth, 0)
            } catch (err) {}
        }
        
    }
    // 用户显示时间回归真实视频时间
    _getRealTimeByUserTime = (userTime) => {
        let sum = 0
        let realTime = 0
        let currentIndex = 0
        this.state.result.filter(v => !v.delete).forEach((item, index) => {
            let itemDuration = item.end - item.start
            if (userTime > (sum + itemDuration)) {  // 已经播放过了这个区间
                sum += itemDuration
            } else { // 还未播放到这个区间
                realTime = (userTime - sum) + item.start
                currentIndex = index
            }
        })
        return {
            currentIndex,
            realTime
        }
    }
    _saveScrollArea = () => {
        // 记录滚动条位置方便恢复
        try {
            this.scrollHideAreaWidth = document.getElementById(this.state.videoListId).scrollLeft || 0
        } catch (err) {}
    }
    // 获取当前播放的真实视频时间 variation是相对用户当前展示的播放时间的改变量
    getRealTime = (variation) => {
        const { currentTime } = this.previewInfo // 获取用户显示的播放时间
        let newUserTime = currentTime + Number(variation)
        return this._getRealTimeByUserTime(newUserTime)
    }
    // 从xx:xx分割视频
    slipVideo = (ts) => {
        this._saveScrollArea()
        // console.log(ts, this.state)
        let aimVideoIndex = this.state.result.findIndex(v => v.start < Number(ts) && v.end > Number(ts) )
        // console.log("aimVideoIndex", aimVideoIndex)
        if (aimVideoIndex < 0) return
        let newResultData = [].concat(this.state.result.slice(0, aimVideoIndex),
        {
            ...this.state.result[aimVideoIndex],
            end: ts,
            endPic: this.curPreviewSrc
        },
        {
            ...this.state.result[aimVideoIndex],
            start: ts,
            startPic: this.curPreviewSrc
        }, 
        this.state.result.slice(aimVideoIndex + 1, this.state.result.length))
        this.addStep(newResultData)
        this._generateVideoPieces()
    }
    // 修改video位置或删除恢复
    changeVideo = (handle, index) => {
        this._saveScrollArea()
        let index1 = index
        let index2 = 0
        switch (handle) {
            case 'remove':
                this.state.result[index].delete = !this.state.result[index].delete 
                const fullTime = this.state.result.filter(v => !v.delete).reduce((a, b) => {return a + (b.end - b.start) }, 0)
                this._setEndTag(fullTime)
                break;
            case 'left':
                if (index1 === 0) { return false }
                index2 = index - 1
                this.state.result.splice(index2,1, ...this.state.result.splice(index1, 1, this.state.result[index2])) // 交换位置
                break;
            case 'right':
                if (index1 === this.state.result.length -1) { return false }
                index2 = index + 1
                this.state.result.splice(index2,1, ...this.state.result.splice(index1, 1, this.state.result[index2])) // 交换位置
                break
            default:
        }
        this._generateVideoPieces()
        this.setPreview()
    }
    // 
    setPreview = () => { // 通过
        if (this.state.result.length === 1) {
            this.previewInfo.fullTime = this.state.result[0].end - this.state.result[0].start
        } else {
            // console.log(this.state.result)
            this.previewInfo.fullTime = this.state.result.filter(v => !v.delete).reduce((a, b) => { return a + Number(b.end - b.start) }, 0)
        }
        this.previewInfo.currentIndex = 0
        this.previewInfo.realTime = 0
        this.currentTime = 0
        this.previewInfo.fullTime = Number(this.previewInfo.fullTime.toFixed(2))
    }
    // listen video play 播放视频时候, 根据视频的真实时间,计算什么时候需要跳转
    onPreview = (currentTime, cb) => {
        const { currentIndex } = this.previewInfo
        this.previewInfo.realTime = currentTime
        let timeUserPlayed = 0
        let canPlayResult = this.state.result.filter(v => !v.delete)
        if (!canPlayResult[currentIndex] || !canPlayResult[currentIndex].end) { 
            // console.log("超出可播放的区间")
            cb("playFinish")
        }
        // 计算之前播放过的区块, 来计算当前用户展示的播放时间
        timeUserPlayed = canPlayResult.filter((v, index) => currentIndex > index).reduce((a, b) => { return a + (Math.round((b.end - b.start) * 100) / 100) }, 0)
        
        const { start, end } = canPlayResult[currentIndex]
        if (currentTime >= start && currentTime < end) {
            // 当前区段还未播放完毕 不需要进行切换
            this.previewInfo.currentTime = timeUserPlayed + Math.round(currentTime - start)
        } else {
            // console.log("=========检测区段===========", this.previewInfo, canPlayResult, currentIndex)
            if (canPlayResult[currentIndex + 1]) {
                // 存在下个可播放的区段,可以跳转播放
                cb("playNext",canPlayResult[currentIndex + 1].start)
                this.previewInfo.currentIndex = this.previewInfo.currentIndex + 1
            } else {
                // 不存在下个区段意味着播放完成
                // console.log("=========不存在下个区段===========", this.previewInfo, canPlayResult, currentIndex)
                cb("playFinish")
            }
        }
    }
    // 跳转到用户指定的预览时间
    jumpToTime = (time) => {
        
    }
    getStartTime = () => {
        let result = 0;
        let canPlayVideoList = this.state.result.filter(v => !v.delete)
        if (canPlayVideoList) {
            result = canPlayVideoList[0].start
        }
        return result
    }
    resetStep = () => {
        const _stepNext = this.store.step + 1  
        this._loadStore(_stepNext)
    }
    lastStep = () => {
        const _stepLast = this.store.step - 1
        this._loadStore(_stepLast)
    }
    addStep = (newArr) => {
        this._coverStore(newArr)
        this.state.result = this._loadStore()
    }
    canLastStep = () => {
        let result = false
        const { save, step } = this.store
        if (step && save.length > 1) {
            result = true
        }
        return result
    }
    canResetStep = () => {
        let result = false
        const { save, step } = this.store
        if (step !== save.length - 1) {
            result = true 
        }
        return result
    }

    // 写入覆盖
    _coverStore = (newArr) => {
        const { updateCallback } = this.state
        let { save, step } = this.store
        let needSave = save.slice(0, step + 1)
        needSave.push(newArr)
        this.store.save = needSave
        this.store.step++
        updateCallback && updateCallback()
    }

    // 读取某一步
    _loadStore = (index) => {
        const { updateCallback } = this.state
        if (!index && index !== 0) {
            index = this.store.step
        }
        this.store.step = index
        this.state.result = this.store.save[index]
        this._generateVideoPieces()
        this.setPreview()
        updateCallback && updateCallback()
        return this.store.save[index]
    }
}