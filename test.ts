import { Script } from './lib/script';
import { currentTime } from './lib/utils/date-time';
import { globals } from './lib/globals';
import { rand } from './lib/utils/numbers';
import { ChartType } from './lib/report/widgets/report-chart';

class Strategy extends Script {
  lastTime: number;

  static definedArgs = [{ key: 'foo', defaultValue: 'bar' }];

  constructor(args: GlobalARGS) {
    super(args);
  }

  async onInit() {
    this.lastTime = currentTime();
  }

  async onTick() {
    if (currentTime() - this.lastTime > 60 * 60 * 10 * 1000) {
      this.lastTime = currentTime();

      const randomValue = rand(1, 100);
      const randomValue2 = rand(1, 70);

      // global.report.chartAddPoint('Test chart', 'Line #1', randomValue, '#13D8AA', { chartType: ChartType.Area });
      // global.report.chartAddPoint('Test chart', 'Line #2', randomValue2, '#FD6A6A', { chartType: ChartType.Line });

      globals.report.chartAddPoint('Test chart', 'Line #1', randomValue, '#00B8D9', { chartType: ChartType.Area });
      globals.report.chartAddPoint('Test chart', 'Line #2', randomValue2, '#FFAB00');
    }
  }

  async onStop() {
    await globals.report.updateReport();
  }
}
