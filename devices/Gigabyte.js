'use strict';
/* Gigabyte Laptop using dkms https://github.com/tangalbert919/gigabyte-laptop-wmi  */
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import * as Helper from '../lib/helper.js';

const {fileExists, readFileInt, runCommandCtl} = Helper;

const GIGABYTE_MODE = '/sys/devices/platform/gigabyte_laptop/charge_mode';
const GIGABYTE_LIMIT = '/sys/devices/platform/gigabyte_laptop/charge_limit';

export const GigabyteSingleBattery = GObject.registerClass({
    Signals: {'threshold-applied': {param_types: [GObject.TYPE_STRING]}},
}, class GigabyteSingleBattery extends GObject.Object {
    constructor(settings) {
        super();
        this.name = 'Gigabyte Laptop';
        this.type = 28;
        this.deviceNeedRootPermission = true;
        this.deviceHaveDualBattery = false;
        this.deviceHaveStartThreshold = false;
        this.deviceHaveVariableThreshold = true;
        this.deviceHaveBalancedMode = true;
        this.deviceHaveAdaptiveMode = false;
        this.deviceHaveExpressMode = false;
        this.deviceUsesModeNotValue = false;
        this.iconForFullCapMode = '100';
        this.iconForBalanceMode = '080';
        this.iconForMaxLifeMode = '060';
        this.endFullCapacityRangeMax = 100;
        this.endFullCapacityRangeMin = 80;
        this.endBalancedRangeMax = 85;
        this.endBalancedRangeMin = 65;
        this.endMaxLifeSpanRangeMax = 85;
        this.endMaxLifeSpanRangeMin = 60;
        this.incrementsStep = 1;
        this.incrementsPage = 5;

        this._settings = settings;
        this.ctlPath = null;
    }

    isAvailable() {
        if (!fileExists(GIGABYTE_MODE))
            return false;
        if (!fileExists(GIGABYTE_LIMIT))
            return false;
        return true;
    }

    async setThresholdLimit(chargingMode) {
        this._updateMode = 'true';
        this._status = 0;
        this._endValue = this._settings.get_int(`current-${chargingMode}-end-threshold`);
        if (this._verifyThreshold())
            return this._status;
        [this._status] = await runCommandCtl(this.ctlPath, 'GIGABYTE_THRESHOLD', this._updateMode, `${this._endValue}`, null);
        if (this._status === 0) {
            if (this._verifyThreshold())
                return this._status;
        }

        if (this._delayReadTimeoutId)
            GLib.source_remove(this._delayReadTimeoutId);
        this._delayReadTimeoutId = null;

        this._delayReadTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
            this._reVerifyThreshold();
            this._delayReadTimeoutId = null;
            return GLib.SOURCE_REMOVE;
        });
        return this._status;
    }

    _verifyThreshold() {
        if (readFileInt(GIGABYTE_MODE) === 1)
            this._updateMode = 'false';
        this.endLimitValue = readFileInt(GIGABYTE_LIMIT);
        if (this._endValue === this.endLimitValue) {
            this.emit('threshold-applied', 'success');
            return true;
        }
        return false;
    }

    _reVerifyThreshold() {
        if (this._status === 0) {
            if (this._verifyThreshold())
                return;
        }
        this.emit('threshold-applied', 'failed');
    }

    destroy() {
        if (this._delayReadTimeoutId)
            GLib.source_remove(this._delayReadTimeoutId);
        this._delayReadTimeoutId = null;
    }
});
