## Install JTL Environment

###  git & docker should be available on your system

Debian/Ubuntu
```bash
sudo apt-get update
sudo apt-get install git
sudo apt-get install docker.io
```
Windows links to installer

- https://git-scm.com/download/win
- https://docs.docker.com/docker-for-windows/install/



### Run the following command to install the environment
```bash
curl -O https://raw.githubusercontent.com/xsystems8/jtl-infra-public/main/init.sh && chmod +x ./init.sh && ./init.sh
```

Follow the instructions to install the environment.

- Enter install directory - workingDir/jtl
- Enter App public port  - 8080 (default)

go to workingDir/jtl

```bash
cd workingDir/jtl
```

### Start the environment

```bash
./run_daemon.sh
```

### Stop the environment

```bash
./stop_daemon.sh
```

Go to http://localhost:8080



## JTL Docs
___
* **Get Started**
  - [Strategies](runtime.md)
  - [Tester](tester.md)
  - [Code Editor](code-ediitor.md)
  - [Config](config.md)


* **Global API**
  - [Environment API](environment-api.md)
  - [Market API](market-api.md)
  - [Trading API](trading-api.md)


* **Lib Interfaces**
  - [BaseObject](base-object.md)
  - [ExtendedScript](extended-script.md)
  - [EventEmitter](event-emitter.md)
  - [Exchange](exchange.md)
  - [TriggerService](trigger-service.md)
  - [Report](report.md)
 
  
