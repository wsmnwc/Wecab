var axios = require("axios");

const TENCENT_TRANS_INIT = "https://fanyi.qq.com/";
const TENCENT_TRANS_API = "https://fanyi.qq.com/api/translate";

let qtv = "";
let qtk = "";
let fy_guid = "";

let target = [];
let replyFunc = (context, msg, at = false) => {};

function transReply(replyMsg) {
    replyFunc = replyMsg;
}

function httpHeader(with_cookie = false) {
    let headers = {
        "Host" : "fanyi.qq.com",
        "Origin" : "https://fanyi.qq.com",
        "Referer" : "https://fanyi.qq.com",
        "DNT" : 1,
        "Sec-Fetch-Dest" : "empty",
        "Sec-Fetch-Mode" : "cors",
        "Accept" : "application/json, text/javascript, */*; q=0.01",
        "Accept-Encoding" : "gzip, deflate, br",
        "Accept-Language" : "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
        "User-Agent" : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.122 Safari/537.36"
    }
    if (with_cookie) headers.cookie = `qtv=${qtv}; qtk=${qtk}; fy_guid=${fy_guid};`
    return headers;
}


function initialise() {
    axios({
        url : TENCENT_TRANS_INIT,
        method : "GET",
        headers : httpHeader()
    }).then(res => {
        qtv = /qtv = "(.+)"/.exec(res.data)[1];
        qtk = /qtk = "(.+)"/.exec(res.data)[1];
        fy_guid = /fy_guid=(.+?); /.exec(res.headers["set-cookie"])[1];
    });
}


function translate(sourceLang, targetLang, sourceText, context, reply) {
    axios({
        url : TENCENT_TRANS_API,
        method : "POST",
        headers : httpHeader(true),
        data : {
            "qtk" : qtk,
            "qtv" : qtv,
            "source" : sourceLang,
            "target" : targetLang,
            "sourceText" : sourceText
        }
    }).then(res => {
        let targetText = "";
        for (let i in res.data.translate.records) {
            targetText += res.data.translate.records[i].targetText;
        }
        trans_text = reply ? targetText : `[${targetText}]`;
        replyFunc(context, trans_text, reply);
    }).catch(err => console.error(err))
}

function toTargetLang(lang_opt) {
    let target_lang = {
        "日" : "jp",
        "韩" : "kr",
        "英" : "en",
        "法" : "fr",
        "德" : "de",
        "俄" : "ru"
    }
    return target_lang[lang_opt];
}

function orientedTrans(context) {
    if (target.indexOf(context.user_id) != -1) {
        let text = context.message.replace(/\[CQ.+?\]/, "");
        translate("auto", "zh", text, context, false);
    }
    else return false;
}

function pointTo(context, user_id) {
    target.push(parseInt(user_id));
    replyFunc(context, `接下来${user_id}说的每句话都会被翻译`);
    return;
}

function unpoint(context, user_id) {
    if (Array.isArray(user_id)) user_id = parseInt(user_id[0]);
    if (target.indexOf(user_id) != -1) {
        target = target.filter(id => {return id != user_id});
        replyFunc(context, `对${user_id}的定向翻译已停止`);
    }
    else replyFunc(context, `${user_id}不在定向翻译列表中`);
}

function viewTarget(context) {
    if (target.length > 0) replyFunc(context, `定向翻译已对下列目标部署\n${target.join(", ")}`);
    else replyFunc(context, `定向翻译无目标`);
}

function transEntry(context) {
    if (/翻译[>＞].+/.test(context.message)) {
        let sourceText = context.message.substring(3, context.message.length);
        translate("auto", "zh", sourceText, context);
        return true;
    }
    else if (/中译[日韩英法德俄][>＞].+/.test(context.message)) {
        let target_lang = toTargetLang(/中译(.)[>＞]/.exec(context.message)[1]);
        translate("zh", target_lang, /中译.[>＞](.+)/.exec(context.message)[1], context);
        return true;
    }
    else if (/^开始定向翻译(\s?\d{9,10}?)?$/.test(context.message)) {
        let user_id = /\d+/.exec(context.message) || context.user_id;
        pointTo(context, user_id);
        return true;
    }
    else if (/^停止定向翻译(\s?\d{9,10}?)?$/.test(context.message)) {
        let user_id = /\d+/.exec(context.message) || context.user_id;
        unpoint(context, user_id);
        return true;
    }
    else if (/^定向翻译列表$/.test(context.message)) {
        if (/owner|admin/.test(context.sender.role)) viewTarget(context);
        else replyFunc(context, "您配吗");
        return true;
    }
    else return false;
}

initialise()
let renewToken = setInterval(initialise, 3600000);

module.exports = {transReply, transEntry, orientedTrans};
