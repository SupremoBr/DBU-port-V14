/** Install domain methods with the same descriptors as native class methods.
 * Validate every group before changing the prototype; collisions are errors.
 */
export function installCharacterMethods(sheetClass, groups) {
  const descriptors = Object.create(null);
  for (const { name, methods } of groups) {
    for (const key of Reflect.ownKeys(methods)) {
      if (key === 'constructor' || Object.hasOwn(sheetClass.prototype, key) || Object.hasOwn(descriptors, key)) {
        throw new Error(`DBU character module ${name}: duplicate method ${String(key)}`);
      }
      const descriptor = Object.getOwnPropertyDescriptor(methods, key);
      if (typeof descriptor.value !== 'function') {
        throw new TypeError(`DBU character module ${name}: ${String(key)} is not a method`);
      }
      descriptors[key] = { ...descriptor, enumerable: false };
    }
  }
  Object.defineProperties(sheetClass.prototype, descriptors);
  return sheetClass;
}
