echo "停止中..."
diskMonitor=$(cat .diskMonitor.pid)

kill -9 $diskMonitor

rm -rf .diskMonitor.pid