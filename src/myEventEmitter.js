/**
 * A simple event emitter class. Objects that inheret this class or implement it can then bubble events up to the UI
 * similar to existings event emitter such as 'onChange' or 'onClick'.
 */
class MyEventEmitter {
  #events;

  /** .
   * .
   * .
   * Default constructor, intializes an empty object to store events
   *
   * @example
   */
  constructor() {
    this.#events = {};
  }

  /**
   * The external API for this class. Gets called with an event name and a callback function that is fired when the event is emitted.
   *
   * @param name
   * @param listener
   * @example
   */
  on(name, listener) {
    if (!this.#events[name]) {
      this.#events[name] = [];
    }

    this.#events[name].push(listener);
  }

  /** .
   * .
   * .
   * Function to remove a listener that was previously set
   *
   * @param {*} name
   * @param {*} listenerToRemove
   * @example
   */
  removeListener(name, listenerToRemove) {
    if (!this.#events[name]) {
      throw new Error(`Can't remove a listener. Event "${name}" doesn't exits.`);
    }

    /**
     *
     * @param listener
     * @example
     */
    const filterListeners = listener => listener !== listenerToRemove;

    this.#events[name] = this.#events[name].filter(filterListeners);
  }

  /**
   * The internal API for this class. Gets called with an event name and a data object.
   * Any callbacks that have been set to listen to the matching event are dispatched.
   *
   * @param name
   * @param data
   * @example
   */
  emit(name, data) {
    if (!this.#events[name]) {
      throw new Error(`Can't emit an event. Event "${name}" doesn't exits.`);
    }
    
    console.log(this.#events[name])
    /**
     *
     * @param {*} callback
     */
    const fireCallbacks = callback => {
      callback(data);
    };

    this.#events[name].forEach(fireCallbacks);
  }
}

export default MyEventEmitter;
