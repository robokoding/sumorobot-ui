#!/bin/bash
curl --request POST http://sumorobot:@${1:-192.168.0.102}/data_success.html -F "CMD=WEB_UPLOAD" -F "files=@dist/sumorobot.bin"
