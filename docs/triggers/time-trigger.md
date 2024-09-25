# TimeTrigger
___

A service for registering tasks by time.

* **Methods**
    - [addTask](#addTask)
    - [cancelTask](#cancelTask)
    - [getAllTasks](#getAllTasks)
    - [getActiveTasks](#getActiveTasks)
    - [getInactiveTasks](#getInactiveTasks)
    - [cancelAll](#cancelAll)


* **Interfaces**
  - [TimeTriggerTask](#timeTriggerTask)

<br>

## Methods

### [registerHandler](#registerHandler)

Registers a handler that will be called when the specified time is reached.

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
  private readonly timeTrigger: PriceTrigger;
  
  constructor() {
    super();
    
    // ...some logic...
    
    this.timeTrigger = new TimeTrigger();
    this.timeTrigger.registerHandler('onTimeReached', this.onTimeReached, this);
  }
  
  async someMethod() {
    // ...some logic...
    
    // Add a task that will call the handler (onTimeReached) when the specified time is reached
    this.timeTrigger.addTask({
      name: 'onTimeReached',
      // the handler must be called no earlier than 10 seconds after the last tick.
      triggerTime: tms() + 10000
    })
  }
  
  async onTimeReached() {
    // ... do something ...   
  }
}
```

___

<br>

### [addTask](#addTask)

Register a callback that is called when the designated time is reached.

```typescript
addTask(params: CreateTimeTaskParams): string
```

* **Parameters**
    - `params`: \<_[CreateTimeTaskParams](#createTimeTaskParams)_> - Task params.


* **Returns:** <_string_> - Task id.

###### Example

```typescript
class SomeClass extends BaseObject {
  private readonly timeTrigger: PriceTrigger;
  
  constructor() {
    super();
    
    // ...some logic...
    
    this.timeTrigger = new TimeTrigger();
    this.timeTrigger.registerHandler('onTimeReached', this.onTimeReached, this);
  }
  
  async someMethod() {
    // ...some logic...
    
    // Add a task that will call the handler (onTimeReached) when the specified time is reached
    this.timeTrigger.addTask({
      name: 'onTimeReached',
      // the handler must be called no earlier than 10 seconds after the last tick.
      triggerTime: tms() + 10000
      
      // only this callback will be called. The handler registered via the registerHandler method in the constructor will be ignored.
      callback: async () => {
        // ...do something...
      }
    })
  }
  
  async onTimeReached() {
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
getAllTasks(): TimeTriggerTask[]
```


* **Returns:** _Array<[TimeTriggerTask](#timeTriggerTask)>_ - Task array.

___

<br>

### [getActiveTasks](#getActiveTasks)

Returns all active tasks.

```typescript
getActiveTasks(): TimeTriggerTask[]
```


* **Returns:** _Array<[TimeTriggerTask](#timeTriggerTask)>_ - Task array.

___

<br>

### [getInactiveTasks](#getInactiveTasks)

Returns all completed tasks.

```typescript
getInactiveTasks(): TimeTriggerTask[]
```


* **Returns:** _Array<[TimeTriggerTask](#timeTriggerTask)>_ - Task array.

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

### [CreateTimeTaskParams](#createTimeTaskParams)

```typescript
interface CreateTimeTaskParams {
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

### [TimeTriggerTask](#timeTriggerTask)

```typescript
interface TimeTriggerTask {
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
  triggerTime: number;
  interval?: number;
}
```
<br>