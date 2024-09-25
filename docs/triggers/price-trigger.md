# PriceTrigger
___

A service for registering tasks by price.

* **Methods**
    - [addTask](#addTask)
    - [cancelTask](#cancelTask)
    - [getAllTasks](#getAllTasks)
    - [getActiveTasks](#getActiveTasks)
    - [getInactiveTasks](#getInactiveTasks)
    - [cancelAll](#cancelAll)


* **Interfaces**
  - [PriceTriggerTask](#priceTriggerTask)
  - [PriceTriggerDirection](#priceTriggerDirection)

<br>

## Methods

### [Constructor](#Constructor)

```typescript
const trigger = new PriceTrigger('ETH/USDT')
```

* **Parameters**
    - `symbol`: \<_string_> - Asset symbol.
___

<br>

### [registerHandler](#registerHandler)

Registers a handler that will be called when the specified asset price is reached.

> Handlers must be registered only in the constructor of the class where the trigger is used.
>> If you need to save tasks (state) after restarting the trading script using [Storage](../storage.md), then register handlers only through this method

<br>

```typescript
registerHandler(taskName: string, handler: Function, owner: BaseObject): void
```

* **Parameters**
  - `taskName`: \<_string_> - Task name.
  - `handler`: \<_Function_> - A class method that will be called when an event occurs.
  - `owner`: \<_[BaseObject](../base-object.md)_> - A reference to the object that contains the event handler. The object must extend from the _[BaseObject](../base-object.md)_ class.

###### Example

```typescript
class SomeClass extends BaseObject {
  private readonly priceTrigger: PriceTrigger;
  
  constructor() {
    super();
    
    this.priceTrigger = new PriceTrigger('BTC/USDT');
    this.priceTrigger.registerHandler('onPriceReached', this.onPriceReached, this);
  }
  
  async someMethod() {
    // ...some logic...
    
    // Add a task that will call the handler (onPriceReached) when a certain asset price is reached
    this.priceTrigger.addTask({
      name: 'onPriceReached',
      triggerPrice: 62500
    })
  }
  
  async onPriceReached() {
    // ... do something ...   
  }
}
```

___

<br>

### [addTask](#addTask)

Register a callback that will be called when the specified asset price is reached.

> If a handler is registered via the [registerHandler](#registerhandler) method and a callback was passed in the parameters when adding a task, then only the callback will be called when an event occurs.

<br>

```typescript
addTask(params: CreatePriceTaskParams): string
```

* **Parameters**
    - `params`: \<_[CreatePriceTaskParams](#createPriceTaskParams)_> - Task params.


* **Returns:** <_string_> - Task id.

###### Example

```typescript
class SomeClass extends BaseObject {
  private readonly priceTrigger: PriceTrigger;
  
  constructor() {
    super();

    // ...some logic...
    
    this.priceTrigger = new PriceTrigger('BTC/USDT');
    this.priceTrigger.registerHandler('onPriceReached', this.onPriceReached, this);
  }
  
  async someMethod() {
    // ...some logic...
    
    // Add a task that will call the handler (onPriceReached) when a certain asset price is reached
    this.priceTrigger.addTask({
      name: 'onPriceReached',
      triggerPrice: 62500,
      // only this callback will be called. The handler registered via the registerHandler method in the constructor will be ignored.
      callback: async () => {
        // ... do something ...
      }
    })
  }
  
  async onPriceReached() {
    // ... do something ...   
  }
}
```

___

<br>

### [cancelTask](#cancelTask)

Cancels a task.

```typescript
cancelTask(taskId: string): void
```

* **Parameters**
    - `taskId`: \<_string_> - Task id.

___

<br>

### [getAllTasks](#getAllTasks)

Returns all active and completed tasks.

```typescript
getAllTasks(): PriceTriggerTask[]
```


* **Returns:** _Array<[PriceTriggerTask](#priceTriggerTask)>_ - Task array.

___

<br>

### [getActiveTasks](#getActiveTasks)

Returns all active tasks.

```typescript
getActiveTasks(): PriceTriggerTask[]
```


* **Returns:** _Array<[PriceTriggerTask](#priceTriggerTask)>_ - Task array.

___

<br>

### [getInactiveTasks](#getInactiveTasks)

Returns all completed tasks.

```typescript
getInactiveTasks(): PriceTriggerTask[]
```


* **Returns:** _Array<[PriceTriggerTask](#priceTriggerTask)>_ - Task array.

___

<br>

### [cancelAll](#cancelAll)

Cancels all active tasks.

```typescript
cancelAll(): void
```

___

<br>

## Interfaces

### [CreatePriceTaskParams](#createPriceTaskParams)

```typescript
interface CreatePriceTaskParams {
  name: string;
  triggerTime: number;
  args?: any;
  callback: (args?: any) => Promise<void>;
  retry?: boolean | number;
  interval?: number;
  comment?: string;
}
```
<br>

### [PriceTriggerTask](#priceTriggerTask)

```typescript
interface PriceTriggerTask {
  id: string;
  name: string;
  args?: any;
  callback: (args?: any) => Promise<void>;
  type: TaskType;
  executedTimes: number;
  retry?: boolean | number;
  isTriggered: boolean;
  isActive: boolean;
  created: string;
  lastExecuted: string | null;
  createdTms: number;
  comment?: string;
  result?: any;
  error?: string;
  symbol: string;
  triggerPrice: number;
  direction: PriceTriggerDirection;
  group?: string;
}
```
<br>

### [PriceTriggerDirection](#priceTriggerDirection)

```typescript
enum PriceTriggerDirection {
  Up = 'up',
  Down = 'down',
}
```
<br>