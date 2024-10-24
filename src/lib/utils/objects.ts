import { BaseObject } from '../base-object';

export const deleteObject = (obj: BaseObject) => {
  if (typeof obj === 'object') {
    if (typeof obj['destroy'] === 'function') {
      obj.destroy();
    }
    obj = undefined;
  }
};
