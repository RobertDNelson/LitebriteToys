#/bin/bash

while [ true ]
do
   /bin/date "+%H:%M:%S"
   /bin/echo "Pulling RSS from last.fm"
   /usr/bin/curl -s http://ws.audioscrobbler.com/1.0/user/CoCoMpls/recenttracks.rss | /usr/bin/grep title | /usr/bin/grep -v audioscrobbler | /usr/bin/uniq | /usr/bin/head -n3 | /usr/bin/sed 's/<[^>]*>//g' | /usr/bin/sed -e 's/^[ ]*//' | /usr/bin/sed 's/–/-/g' > nowplaying.txt
   /bin/date "+%H:%M:%S"
   /bin/echo "Got RSS. Updating the board."
   /Users/jcardinal/github/LitebriteToys/src/python/nowplayingv1.py /Users/jcardinal/github/LitebriteToys/src/python/nowplaying.txt
   /bin/date "+%H:%M:%S"
   /bin/echo "Updated board. Waiting 45 seconds, then repeating."
   /bin/sleep 45
done
