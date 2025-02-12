const SerialNumber = {
    _last: Math.round(performance.now()),
    next() { return ++this._last; },
};

export default SerialNumber;
