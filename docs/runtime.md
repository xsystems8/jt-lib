# Strategies
___


## Creating a Strategy
###### Required params

- `Name`: Name of the test scenario.
- `Prefix`: The prefix is used to generate the clientOrderId. Scripts with the market launch type will only receive orders created with this prefix.
- `Strategy`: Trading script file. The Strategy class is described inside the file.
- `type` - market or system. 
  - If the launch type is market, then the script will be launched for only one symbol. 
  - If system, then the script will have no trading functions, but will be able to receive notifications about all orders onOrderChange.

###### Additional params

- `Symbol`: The trading symbol on which the strategy will be launched. 
- `Exchange`: The exchange on which the strategy will be launched.
- `isHedge`: Determines whether the mode of opening a position in both directions is enabled on the exchange.

![image](./img/create-scanerio-runtime.jpg)


## Running the script

### Control buttons

- `Run`: Runs the script.
- `Stop`: Stops the script.
- `Report`: Opens the report window.
- `Config`: Updates the script configuration. You can change additional parameters without stopping the script. Changes will be sent to the script in the onArgsChange event.
- `Logs`: Opens the log window.
- `Delete`: Deletes a script.

![image](./img/runtime-tab.jpg)




