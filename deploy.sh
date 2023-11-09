#!/bin/bash

node bin/azgallery.js build --debug
git add --all
git commit --message "Updated site."
git push --set-upstream origin master
