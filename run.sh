#!/bin/bash

java -Dhttp.proxyHost=icache -Dhttp.proxyPort=80 -jar core/target/wrapper-jar-with-dependencies.jar debug
