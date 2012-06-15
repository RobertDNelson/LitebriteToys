#!/usr/bin/env python

import sys
import urllib
import urllib2
import json
import time

# Board dimensions (Writing past the end of the board loops back to the start of the line and reverts to green))
boardHeight = 12
boardWidth = 80

# Read in file and confirm contents will fit on the board
filename = sys.argv[1]
f = open(filename, 'r')
contents = f.readlines()
f.close()
if len(contents) > boardHeight:
    print "The file is too long. There is only room for " + str(boardHeight) + " lines."
    sys.exit()
for line in contents:
    if len(line) > boardWidth:
        print "There is a line that is too long to fit on the board. The board is " + str(boardWidth) + " characters wide."
        sys.exit()

# Get a lease
duration = 1 # The script should be able to do its work in 1 minute.
f = urllib2.urlopen('http://10.1.3.251/litebrite/peggy/get_lease/' + str(duration))
# get_lease response is in JSON. Learn to get lease code, or fail gracefully if lease is unavailable.
jsonresponse = json.loads(f.read())
leasecode = jsonresponse[u'lease_code']

f = urllib2.urlopen('http://10.1.3.251/litebrite/peggy/clear/' + leasecode)
f = urllib2.urlopen('http://10.1.3.251/litebrite/peggy/set_color/' + leasecode + '/red')

# Write message to the board
row = 0
col = 0
for line in contents:
    f = urllib2.urlopen('http://10.1.3.251/litebrite/peggy/write/' + leasecode + '/' + str(row) + '/' + str(col) + '/' + urllib.quote(line, ''))
    row = row + 1
    time.sleep(0.5)

print "Done"
