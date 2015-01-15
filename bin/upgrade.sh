#!/bin/bash
curl --request POST http://sumorobot:@${1:-10.10.100.254}/data_success.html -F "CMD=WEB_UPLOAD" -F "files=@dist/sumorobot.bin"
