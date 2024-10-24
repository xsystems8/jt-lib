import { BaseObject } from '../../base-object';

export class ReportWidget extends BaseObject {
  isVisible = true;

  setVisible(visible: boolean) {
    this.isVisible = visible;
  }
}
