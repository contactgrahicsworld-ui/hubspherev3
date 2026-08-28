#!/bin/bash
cd /home/z/my-project
unset DATABASE_URL
export NODE_ENV=development
exec npx next dev -p 3000 -H 0.0.0.0
