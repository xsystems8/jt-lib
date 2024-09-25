# OrderTrigger
___

A service for registering tasks by order.

* **Methods**
    - [registerHandler](#registerHandler)
    - [addTask](#addTask)
    - [cancelTask](#cancelTask)
    - [getAllTasks](#getAllTasks)
    - [getActiveTasks](#getActiveTasks)
    - [getInactiveTasks](#getInactiveTasks)
    - [cancelAll](#cancelAll)


* **Interfaces**
  - [OrderTriggerTask](#orderTriggerTask)

<br>

## Methods

### [registerHandler](#registerHandler)

Registers a handler that will be called when the order is changed.

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
  private readonly orderTrigger: OrderTrigger;
  
  constructor() {
    super();

    // ...some logic...
    
    this.orderTrigger = new OrderTrigger();
    this.orderTrigger.registerHandler('orderClosed', this.onOrderClosed, this);
  }
  
  async createOrder() {
    // ...some logic...
    
    const order = await createOrder('ETH/USDT', 'market', 'buy', 1, 2800);
    
    // add a task that will call the handler (onOrderClosed) when the order is updated with the closed status
    this.orderTrigger.addTask({
      name: 'orderClosed',
      orderId: order.id,
      status: 'closed',
      args: order.id // this parameter will be passed as an argument to the handler function
    })
  }
  
  async onOrderClosed(orderId: string) {
    // ... do something ...   
  }
}
```

___

<br>

### [addTask](#addTask)

Registers a callback that will be called when the order is changed.

> If a handler is registered via the [registerHandler](#registerhandler) method and a callback was passed in the parameters when adding a task, then only the callback will be called when an event occurs.

<br>

```typescript
addTask(params: CreateOrderTaskParams): string
```

* **Parameters**
    - `params`: \<_[CreateOrderTaskParams](#createOrderTaskParams)_> - Task params.


* **Returns:** <_string_> - Task id.

###### Example

```typescript
class SomeClass extends BaseObject {
  private readonly orderTrigger: OrderTrigger;
  
  constructor() {
    super();
    
    this.orderTrigger = new OrderTrigger();
    this.orderTrigger.registerHandler('orderClosed', this.onOrderClosed, this);
  }
  
  async createOrder() {
    // ...some logic...
    
    const order = await createOrder('ETH/USDT', 'market', 'buy', 1, 2800);
    
    // add a task that will call the handler (onOrderClosed) when the order is updated with the closed status
    this.orderTrigger.addTask({
      name: 'orderClosed',
      orderId: order.id,
      status: 'closed',
      // only this callback will be called. The handler registered via the registerHandler method in the constructor will be ignored.
      callback: () => {
        // ... do something ...
      }
    })
  }
  
  async onOrderClosed(orderId: string) {
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
getAllTasks(): OrderTriggerTask[]
```


* **Returns:** _Array<[OrderTriggerTask](#orderTriggerTask)>_ - Task array.

___

<br>

### [getActiveTasks](#getActiveTasks)

Returns all active tasks.

```typescript
getActiveTasks(): OrderTriggerTask[]
```


* **Returns:** _Array<[OrderTriggerTask](#orderTriggerTask)>_ - Task array.

___

<br>

### [getInactiveTasks](#getInactiveTasks)

Returns all completed tasks.

```typescript
getInactiveTasks(): OrderTriggerTask[]
```


* **Returns:** _Array<[OrderTriggerTask](#orderTriggerTask)>_ - Task array.

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

### [CreateOrderTaskParams](#createOrderTaskParams)

```typescript
interface CreateOrderTaskParams {
  name: string;
  orderId?: string;
  clientOrderId?: string;
  args?: any;
  callback: (args?: any) => Promise<void>;
  status: 'open' | 'closed' | 'canceled';
  retry?: boolean | number;
  comment?: string;
  group?: string;
}
```
<br>

### [OrderTriggerTask](#orderTriggerTask)

```typescript
interface OrderTriggerTask {
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
  orderId?: string;
  clientOrderId?: string;
  status: 'open' | 'closed' | 'canceled';
  group?: string;
}
```
<br>