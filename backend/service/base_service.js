var knex = require('../connect/mysql').knex;
var PV = require('../utils/validation');
var {isArrayEmpty, isString} = require('../utils/objects');
var logger = require('../utils/logger').getLogger('base-service');
const Page = require('../utils/pageable').Page;
const Filters = require('../utils/filters').Filters;
const FIELD_ID = 'eid';
const DELETED = require('../const/active_type').DELETED;
const fakeDeleteObj = {deleted: DELETED};
const eidFilter = eid => new Filters().eq(FIELD_ID, eid);

class BaseService {

  constructor(tableName) {
    Object.defineProperty(this, "TABLE_NAME", {
      configurable: false,
      writable: false,
      enumerable: true,
      value: tableName
    });
  }

  assembleFilters(statement, filters) {
    if (filters instanceof Filters) {
      for (let {field, comp, value} of filters) {
        statement.where(field, comp, value);
      }
    }
    return statement;
  }

  *findAll(sort) {
    const _filter = this.getFilters();
    let statement = this.getKnex().select().where(_filter.toObject());
    this.buildSort(statement, sort);
    var rows = yield statement;
    return this.returnList(rows);
  }

  *findPageByFilter(pn, ps, filters, sort) {
    var total = yield* this.getTotalCount(filters);
    const _filters = this.getFilters(filters);
    let statement = this.getKnex().select();
    this.assembleFilters(statement, _filters).limit(ps).offset((pn - 1) * ps);
    this.buildSort(statement, sort);
    var rows = yield statement;
    return new Page(total, this.returnList(rows), pn, ps);
  }

  *getTotalCount(filters) {
    const _filter = this.getFilters(filters);
    let statement = this.getKnex().count('* as total');
    var rows = yield this.assembleFilters(statement, _filter);
    return !isArrayEmpty(rows) && rows[0].total || 0;
  }

  /**
   * 根据过滤条件查询
   * @returns {*}
   */
  *findListByFilter(filters, sort) {
    var pv_err = PV().obj('findListByFilter-filters', filters).validate();
    if (pv_err) throw pv_err;
    const _filter = this.getFilters(filters);
    let statement = this.getKnex().select();
    statement = this.assembleFilters(statement, _filter);
    this.buildSort(statement, sort);
    var rows = yield statement;
    return this.returnList(rows);
  }

  *findOneById(eid) {
    var pv_err = PV().num('findOneById-eid', eid).validate();
    if (pv_err) throw pv_err;
    const _filter = this.getFilters(eidFilter(eid));
    var statement = this.getKnex().select().where(_filter.toObject());
    var rows = yield statement;
    return !isArrayEmpty(rows) && this.transformOne(rows[0]) || {};
  }

  *findListByIds(eids, sort) {
    var pv_err = PV().arr('findListByIds-eids', eids).validate();
    if (pv_err) throw pv_err;
    return yield* this.findListByWhereIn(FIELD_ID, eids, sort);
  }

  /**
   * 根据某一字段用in查询
   * @param {string} prop
   * @param {Array} values
   * @returns {*}
   */
  *findListByWhereIn(prop, values, sort) {
    var pv_err = PV().str('findListByWhereIn-prop', prop).arr('findListByWhereIn-values', values).validate();
    if (pv_err) throw pv_err;
    const _filter = this.getFilters();
    let statement = this.getKnex().select().where(_filter.toObject()).whereIn(prop, values);
    this.buildSort(statement, sort);
    var rows = yield statement;
    return this.returnList(rows);
  }

  /**
   * 保存一条并返回新插入记录的ID
   * @param {object} entity
   * @returns {boolean|*}
   */
  *saveEntity(entity) {
    var pv_err = PV().obj('saveEntity-entity', entity).validate();
    if (pv_err) throw pv_err;
    var statement = this.getKnex().insert(entity);
    var rows = yield statement;
    return !isArrayEmpty(rows) && rows[0];
  }

  /**
   * 保存多条
   * @param {Array.<object>} entities
   * @returns {*}
   */
  *saveEntities(entities) {
    var pv_err = PV().arr('saveEntity-entity', entities).validate();
    if (pv_err) throw pv_err;
    var statement = this.getKnex().insert(entities);
    var rows = yield statement;
    return !isArrayEmpty(rows) && rows[0];
  }

  *updateEntities(filters, updateObj) {
    var pv_err = PV().obj('updateEntities-filters', filters).obj('updateEntities-updateObj', updateObj).validate();
    if (pv_err) throw pv_err;
    var statement = this.getKnex();
    statement = this.assembleFilters(statement, filters);
    return yield statement.update(updateObj);
  }

  *updateEntitiesByWhereIn(prop, values, updateObj) {
    var pv_err = PV().str('updateEntitiesByWhereIn-prop', prop).arr('updateEntitiesByWhereIn-values',
      values).obj('updateEntitiesByWhereIn-updateObj', updateObj).validate();
    if (pv_err) throw pv_err;
    return yield this.getKnex().whereIn(prop, values).update(updateObj);
  }

  *updateEntityById(eid, updateObj) {
    var pv_err = PV().num('updateEntityById-eid', eid).obj('updateEntityById-updateObj',
      updateObj).validate();
    if (pv_err) throw pv_err;
    return yield this.getKnex().where(FIELD_ID, eid).update(updateObj);
  }

  *updateEntitiesByIds(eids, updateObj) {
    var pv_err = PV().arr('updateEntitiesByIds-eids', eids).obj('updateEntitiesByIds-updateObj',
      updateObj).validate();
    if (pv_err) throw pv_err;
    return yield this.getKnex().whereIn(FIELD_ID, eids).update(updateObj);
  }

  *deleteEntityById(eid) {
    var pv_err = PV().num('deleteEntityById-eid', eid).validate();
    if (pv_err) throw pv_err;
    return yield* this.updateEntities(eidFilter(eid), fakeDeleteObj);
  }

  *deleteEntities(filters) {
    var pv_err = PV().obj('deleteEntities-filters', filters).validate();
    if (pv_err) throw pv_err;
    return yield* this.updateEntities(filters, fakeDeleteObj);
  }

  *deleteEntitiesByWhereIn(prop, values) {
    var pv_err = PV().str('deleteEntitiesByWhereIn-prop', prop).arr('deleteEntitiesByWhereIn-values',
      values).validate();
    if (pv_err) throw pv_err;
    return yield* this.updateEntitiesByWhereIn(prop, values, fakeDeleteObj);
  }

  *deleteEntitiesByIds(eids) {
    var pv_err = PV().arr('deleteEntitiesByIds-eids', eids).validate();
    if (pv_err) throw pv_err;
    return yield* this.updateEntitiesByIds(eids, fakeDeleteObj);
  }

  getKnex() {
    return knex(this.TABLE_NAME);
  }

  /**
   * 把sort拆分成statement中的orderBy
   * @param {*} statement
   * @param {Sort} sort
   */
  buildSort(statement, sort) {
    if (sort && sort.length()) {
      sort.getOrders().forEach(([property, direction]) => statement.orderBy(property, direction));
    }
  }

  getFilters(filters) {
    logger.debug('Invoke method getFilters of baseService');
    return filters instanceof Filters ? filters : new Filters();
  }

  /**
   * 统一返回List方法
   * @param rows
   * @returns {boolean|*|Array}
   */
  returnList(rows) {
    return !isArrayEmpty(rows) && this.transformList(rows) || [];
  }

  transformList(entities) {
    return !isArrayEmpty(entities) && entities.map(entity => this.transformOne(entity)) || [];
  }

  transformOne(entity) {
    logger.warn('Super method should not be invoked!');
    return entity;
  }
}

const wrapValue = value => isString(value) && ["'", value, "'"].join('') || value;
/**
 * 监听查询打印SQL语句
 */
knex.on('query', function (data) {
  let val_arr = data.bindings, sql_str = data.sql, index = 0;
  if (!isArrayEmpty(val_arr)) {
    while (sql_str.indexOf('?') > 0 && ++index) {
      sql_str = sql_str.replace('?', wrapValue(val_arr[index - 1]));
    }
  }
  logger.debug("SQL:", sql_str);
});

module.exports = BaseService;