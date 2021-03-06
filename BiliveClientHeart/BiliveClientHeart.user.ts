// ==UserScript==
// @name        BiliveClientHeart
// @namespace   https://github.com/lzghzr/TampermonkeyJS
// @version     0.1.6
// @author      lzghzr
// @description B站直播客户端心跳
// @include     /^https?:\/\/live\.bilibili\.com\/(?:blanc\/)?\d/
// @connect     passport.bilibili.com
// @connect     api.live.bilibili.com
// @connect     live-trace.bilibili.com
// @require     https://cdn.jsdelivr.net/gh/lzghzr/TampermonkeyJS@55fdb489ce4d3f73c02a4ddec9a6979023b7479c/libBilibiliToken/libBilibiliToken.js
// @require     https://cdn.jsdelivr.net/gh/lzghzr/TampermonkeyJS@fe2340677328762f9d6e9686603e9781d69cd3c9/libWasmHash/libWasmHash.js
// @license     MIT
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_xmlhttpRequest
// @run-at      document-end
// ==/UserScript==
/// <reference path='BiliveClientHeart.d.ts' />
import BilibiliToken from '../libBilibiliToken/libBilibiliToken'
import WasmHash from '../libWasmHash/libWasmHash'
import { GM_getValue, GM_setValue, GM_xmlhttpRequest } from '../@types/tm_f'
  ;
(async () => {
  // BilibiliLive写入较慢, 需要等一会儿
  await Sleep(5000)
  const W = typeof unsafeWindow === 'undefined' ? window : unsafeWindow

  if (W.BilibiliLive === undefined) return console.error(GM_info.script.name, '未获取到uid')
  const uid = W.BilibiliLive.UID
  const tid = W.BilibiliLive.ANCHOR_UID
  if (uid === 0) return console.error(GM_info.script.name, '未获取到uid')
  // 利用libBilibiliToken实现一些客户端功能
  const appToken = new BilibiliToken()
  const baseQuery = `actionKey=appkey&appkey=${BilibiliToken.appKey}&build=5561000&channel=bili&device=android&mobi_app=android&platform=android&statistics=%7B%22appId%22%3A1%2C%22platform%22%3A3%2C%22version%22%3A%225.57.0%22%2C%22abtest%22%3A%22%22%7D`
  // 可以直接保存json, 这里只是习惯
  let tokenData = <BiliveClientHeartConfig>JSON.parse(GM_getValue('userToken', '{}'))
  const setToken = async () => {
    const userToken = await appToken.getToken()
    if (userToken === undefined) return console.error(GM_info.script.name, '未获取到token')
    tokenData = userToken
    GM_setValue('userToken', JSON.stringify(tokenData))
    return 'OK'
  }
  const getInfo = () => XHR<userinfo>({
    GM: true,
    anonymous: true,
    method: 'GET',
    url: `https://passport.bilibili.com/x/passport-login/oauth2/info?${appToken.signLoginQuery(`access_key=${tokenData.access_token}`)}`,
    responseType: 'json',
    headers: appToken.headers
  })
  // 在线状态
  const RandomHex = (length: number): string => {
    const words = '0123456789abcdef'
    let randomID = ''
    randomID += words[Math.floor(Math.random() * 15) + 1]
    for (let i = 0; i < length - 1; i++) randomID += words[Math.floor(Math.random() * 16)]
    return randomID
  }
  const uuid = () => RandomHex(32).replace(/(\w{8})(\w{4})\w(\w{3})\w(\w{3})(\w{12})/, `$1-$2-4$3-${'89ab'[Math.floor(Math.random() * 4)]}$4-$5`)
  const mobileHeartBeatJSON = {
    platform: 'android',
    uuid: uuid(),
    buvid: appToken.buvid,
    seq_id: '1',
    room_id: '{room_id}',
    parent_id: '6',
    area_id: '283',
    timestamp: '{timestamp}',
    secret_key: 'axoaadsffcazxksectbbb',
    watch_time: '60',
    up_id: '{target_id}',
    up_level: '40',
    jump_from: '30000',
    gu_id: RandomHex(43),
    play_type: '0',
    play_url: '',
    s_time: '0',
    data_behavior_id: '',
    data_source_id: '',
    up_session: 'l:one:live:record:{room_id}:{last_wear_time}',
    visit_id: RandomHex(32),
    watch_status: '%7B%22pk_id%22%3A0%2C%22screen_status%22%3A1%7D',
    click_id: uuid(),
    session_id: '',
    player_type: '0',
    client_ts: '{client_ts}'
  }
  const wasm = new WasmHash()
  await wasm.init()
  const clientSign = (data: Record<string, string>) =>
    wasm.hash('BLAKE2b512',
      wasm.hash('SHA3-384',
        wasm.hash('SHA384',
          wasm.hash('SHA3-512',
            wasm.hash('SHA512', JSON.stringify(data))
          )
        )
      )
    )
  const getFansMedal = async (): Promise<fansMedalData[] | void> => {
    const funsMedals = await XHR<fansMedalLlist>({
      GM: true,
      anonymous: true,
      method: 'GET',
      url: `https://api.live.bilibili.com/fans_medal/v1/FansMedal/get_list_in_room?${BilibiliToken.signQuery(`access_key=${tokenData.access_token}&target_id=${tid}&uid=${uid}&${baseQuery}`)}`,
      responseType: 'json',
      headers: appToken.headers
    })
    if (funsMedals !== undefined && funsMedals.response.status === 200)
      if (funsMedals.body.code === 0)
        if (funsMedals.body.data.length > 0) return funsMedals.body.data
  }
  const getGiftNum = async (): Promise<number> => {
    let count = 0
    const bagInfo = await XHR<bagList>({
      GM: true,
      anonymous: true,
      method: 'GET',
      url: `https://api.live.bilibili.com/xlive/app-room/v1/gift/bag_list?${BilibiliToken.signQuery(`access_key=${tokenData.access_token}&room_id=${W.BilibiliLive.ROOMID}&${baseQuery}`)}`,
      responseType: 'json',
      headers: appToken.headers
    })
    if (bagInfo !== undefined && bagInfo.response.status === 200)
      if (bagInfo.body.code === 0)
        if (bagInfo.body.data.list.length > 0)
          for (const giftData of bagInfo.body.data.list)
            if (giftData.gift_id === 30607) {
              const expire = (giftData.expire_at - Date.now() / 1000) / 60 / 60 / 24
              if (expire > 6 && expire <= 7) count += giftData.gift_num
            }
    return count
  }
  const mobileHeartBeat = async (postJSON: Record<string, string>): Promise<boolean> => {
    const sign = clientSign(postJSON)
    let postData = ''
    for (const i in postJSON) postData += `${i}=${encodeURIComponent(postJSON[i])}&`
    postData += `client_sign=${sign}`
    const mobileHeartBeat = await XHR<mobileHeartBeat>({
      GM: true,
      anonymous: true,
      method: 'POST',
      url: 'https://live-trace.bilibili.com/xlive/data-interface/v1/heartbeat/mobileHeartBeat',
      data: BilibiliToken.signQuery(`access_key=${tokenData.access_token}&${postData}&${baseQuery}`),
      responseType: 'json',
      headers: appToken.headers
    })
    if (mobileHeartBeat !== undefined && mobileHeartBeat.response.status === 200)
      if (mobileHeartBeat.body.code === 0) return true
    return false
  }
  // 开始客户端心跳
  if (tokenData.access_token === undefined && await setToken() === undefined) return
  else {
    const userInfo = await getInfo()
    if (userInfo === undefined) return console.error(GM_info.script.name, '获取用户信息错误')
    if (userInfo.body.code !== 0 && await setToken() === undefined) return
    else if (userInfo.body.data.mid !== uid && await setToken() === undefined) return
  }
  console.log(GM_info.script.name, '开始客户端心跳')
  // 开始挂机小心心
  const giftNum = await getGiftNum()
  if (giftNum < 24) {
    const fansMedal = await getFansMedal()
    if (fansMedal !== undefined) {
      const control = 24 - giftNum
      const loopNum = Math.ceil(control / fansMedal.length) * 5
      for (let i = 0; i < loopNum; i++) {
        let count = 0
        for (const funsMedalData of fansMedal) {
          if (count >= control) break
          const postData = Object.assign({}, mobileHeartBeatJSON, {
            room_id: funsMedalData.room_id.toString(),
            timestamp: (BilibiliToken.TS - 60).toString(),
            up_id: funsMedalData.target_id.toString(),
            up_session: `l:one:live:record:${funsMedalData.room_id}:${funsMedalData.last_wear_time}`,
            client_ts: BilibiliToken.TS.toString()
          })
          await mobileHeartBeat(postData)
          count++
        }
        await Sleep(60 * 1000)
      }
    }
  }
  /**
   * 使用Promise封装xhr
   * 因为上下文问题, GM_xmlhttpRequest为单独一项
   * fetch和GM_xmlhttpRequest兼容过于复杂, 所以使用XMLHttpRequest
   *
   * @template T
   * @param {XHROptions} XHROptions
   * @returns {(Promise<response<T> | undefined>)}
   */
  function XHR<T>(XHROptions: XHROptions): Promise<response<T> | undefined> {
    return new Promise(resolve => {
      const onerror = (error: any) => {
        console.error(GM_info.script.name, error)
        resolve(undefined)
      }
      if (XHROptions.GM) {
        if (XHROptions.method === 'POST') {
          if (XHROptions.headers === undefined) XHROptions.headers = {}
          if (XHROptions.headers['Content-Type'] === undefined)
            XHROptions.headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=utf-8'
        }
        XHROptions.timeout = 30 * 1000
        XHROptions.onload = res => resolve({ response: res, body: res.response })
        XHROptions.onerror = onerror
        XHROptions.ontimeout = onerror
        GM_xmlhttpRequest(XHROptions)
      }
      else {
        const xhr = new XMLHttpRequest()
        xhr.open(XHROptions.method, XHROptions.url)
        if (XHROptions.method === 'POST' && xhr.getResponseHeader('Content-Type') === null)
          xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=utf-8')
        if (XHROptions.cookie) xhr.withCredentials = true
        if (XHROptions.responseType !== undefined) xhr.responseType = XHROptions.responseType
        xhr.timeout = 30 * 1000
        xhr.onload = ev => {
          const res = <XMLHttpRequest>ev.target
          resolve({ response: res, body: res.response })
        }
        xhr.onerror = onerror
        xhr.ontimeout = onerror
        xhr.send(XHROptions.data)
      }
    })
  }
  /**
   *
   * @param {number} ms
   * @returns {Promise<'sleep'>}
   */
  function Sleep(ms: number): Promise<'sleep'> {
    return new Promise<'sleep'>(resolve => setTimeout(() => resolve('sleep'), ms))
  }
})()