#!/bin/bash

node build.js
git add --all
git commit --message "Updated site."
git push --set-upstream origin master
