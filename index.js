const cprocess = require('child_process');
const fs = require('fs');
const request = require('request');
require('./logger.js');
var os = require('os');

var defaultConfig = {
    "url": "http://127.0.0.1:9001/send",
    "serverName": "服务器",
    "disks": [
        {
            "filesystem": "/dev/vda1",
            "use": 95
        }
    ]
};

var config = null;
try {
    config = JSON.parse(fs.readFileSync('./config.json').toString());
} catch (e) {
    config = defaultConfig;
}

if (config && config.disks) {
    for (let i = 0; i < config.disks.length; i++) {
        config.disks[i].full = false;
        config.disks[i].lastNotifyMinutesFromFullTime = null;
    }
}

var fpn_filesystem = ["文件系统", "Filesystem"];
var fpn_size = ["容量", "Size"];
var fpn_uesd = ["已用", "Used"];
var fpn_avail = ["可用", "Available", "Avail"];
var fpn_usedp = ["已用%", "Use%", "Capacity"];

function getAnyProp(obj, propNames) {
    if (obj == null || propNames == null) {
        return null;
    }
    for (let i = 0; i < propNames.length; i++) {
        let value = obj[propNames[i]];
        if (value == undefined || value == null) {
            continue;
        } else {
            return value;
        }
    }
    return null;
}

function formatout(stdout) {
    let s = stdout.split("\n");
    let propNames = s[0].split(/\s+/g);

    let result = new Array();
    for (let i = 1; i < s.length; i++) {
        let obj = {};
        let row = s[i].split(/\s+/g);
        for (let propIndex = 0; propIndex < propNames.length; propIndex++) {
            obj[propNames[propIndex]] = row[propIndex];
        }
        result.push(obj);
    }
    return result;
}

function convertFiles(ori) {
    let result = new Array();
    if (ori == null) {
        return result;
    }

    for (let i = 0; i < ori.length; i++) {
        let obj = {};
        let item = ori[i];
        obj.filesystem = getAnyProp(item, fpn_filesystem);
        obj.size = getAnyProp(item, fpn_size);
        obj.used = getAnyProp(item, fpn_uesd);
        obj.avail = getAnyProp(item, fpn_avail);
        obj.usedp = parseInt(getAnyProp(item, fpn_usedp));

        result.push(obj);
    }

    return result;
}

function check() {
    if (config.disks == null) {
        console.log('没有配置监控硬盘');
        return;
    }
    console.log("检查磁盘空间");
    cprocess.exec('df -h', function (error, stdout, stderr) {
        if (error !== null) {
            console.log('exec error: ' + error);
        } else {
            // console.log(stdout);
            let result = convertFiles(formatout(stdout));

            for (let i = 0; i < config.disks.length; i++) {
                let fs = config.disks[i];
                let currentFs = findFs(result, fs.filesystem);
                if (currentFs == null) {
                    console.log("没找到文件系统：" + fs.filesystem);
                    continue;
                }

                let currentFull = currentFs.usedp >= fs.use;
                if (currentFull == true && fs.full == true) {
                    if (fs.fullTime) {
                        var minutes = parseInt((new Date().getTime() - fs.fullTime.getTime()) / 1000 / 60);
                        if (minutes != 0 && minutes != fs.lastNotifyMinutesFromFullTime && minutes % 5 == 0) {
                            // 再通知
                            notify(currentFs, fs, true);
    
                            fs.lastNotifyMinutesFromFullTime = minutes;
                        }
                    }
                    // 没变，忽略
                    continue;
                } else if (currentFull == false && fs.full == true) {
                    // 恢复
                    notify(currentFs, fs, false);
                    fs.full = false;
                    fs.lastNotifyMinutesFromFullTime = null;
                    fs.downTime = null;
                } else if (currentFull == true && fs.full == false) {
                    // 满了
                    notify(currentFs, fs, true);
                    fs.full = true;
                    fs.fullTime = new Date();
                    fs.lastNotifyMinutesFromFullTime = 0;
                }

            }

            setTimeout(() => {
                check();
            }, 3000);
        }
    });
}

function notify(currentFs, fs, fulled) {
    var msg = null;
    if (fulled == true) {
        msg = "【磁盘耗尽】" + config.serverName + "的磁盘 \"" + fs.filesystem + " (" + currentFs.size + ")\" 使用率已达到" + currentFs.usedp + "% 以上，请尽快处理";
    } else {
        msg = "【磁盘恢复】" + config.serverName + "的磁盘 \"" + fs.filesystem + " (" + currentFs.size + ")\" 使用率已降低至" + currentFs.usedp + "% 以下，请知悉";
    }

    let url = config.url.replace(/\{\{content\}\}/g, encodeURIComponent(msg));
    request(url, null, (err, res, body) => {
        if (err) { return console.log(err); }
        console.log(body);
    });
}

function findFs(fsarray, fsname) {
    if (fsarray == null || fsname == null) {
        return null;
    }
    for (let i = 0; i < fsarray.length; i++) {
        if (fsarray[i].filesystem == fsname) {
            return fsarray[i];
        }
    }
    return null;
}
if (os.platform() != 'linux' && os.platform() != 'darwin') {
    console.log("该程序目前只支持linux，按回车退出！");

    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('', () => {
        rl.close();
    });

    return;
}

check();