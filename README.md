# diskMonitor
linux磁盘占用率监控，webhook报警

配置文件说明：
```
{
    "url": "磁盘超过disks.use设定的百分比占用率或恢复时，会调用此webhook回调，例如：http://127.0.0.1:1234/send/{{content}}",
    "serverName": "通知信息中的服务器名字，例如：xxx服务器",
    "disks": [
        {
            "filesystem": "磁盘地址，可以用df -h命令找到要监控的磁盘，例如：/dev/vda1",
            "use": 95 // 使用率警戒线
        }
    ]
}
```
