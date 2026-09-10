import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { getPagination, buildMeta } from '../utils/pagination.js';
import { recordAudit, AUDIT_ACTIONS } from '../services/auditService.js';

export function buildCrudController(Model, options = {}) {
  const {
    searchableFields = [],
    filterableFields = [],
    populate = [],
    defaultSort = '-createdAt',
    dependents = [], // [{ Model, field, label }] checked before delete
    beforeCreate = null, // async (data, req) => data
    beforeUpdate = null, // async (data, existing, req) => data
    beforeList = null, // async (filter, req) => void
  } = options;

  const moduleName = Model.modelName;

  const list = asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    if (req.query.search && searchableFields.length > 0) {
      const regex = new RegExp(req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = searchableFields.map((field) => ({ [field]: regex }));
    }

    for (const field of filterableFields) {
      if (req.query[field]) filter[field] = req.query[field];
    }

    if (beforeList) await beforeList(filter, req);

    let query = Model.find(filter).sort(defaultSort).skip(skip).limit(limit);
    for (const p of populate) query = query.populate(p);

    const [items, total] = await Promise.all([query, Model.countDocuments(filter)]);

    return sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
  });

  const getById = asyncHandler(async (req, res) => {
    let query = Model.findById(req.params.id);
    for (const p of populate) query = query.populate(p);
    const doc = await query;
    if (!doc) throw ApiError.notFound(`${moduleName} not found`);
    return sendSuccess(res, { data: doc });
  });

  const create = asyncHandler(async (req, res) => {
    const data = beforeCreate ? await beforeCreate(req.body, req) : req.body;
    const doc = await Model.create(data);

    await recordAudit(req, {
      action: AUDIT_ACTIONS.CREATE,
      module: moduleName,
      entityId: doc._id,
      entityModel: moduleName,
      newValue: doc.toObject(),
    });

    return sendSuccess(res, { statusCode: 201, message: `${moduleName} created`, data: doc });
  });

  const update = asyncHandler(async (req, res) => {
    const existing = await Model.findById(req.params.id);
    if (!existing) throw ApiError.notFound(`${moduleName} not found`);

    const oldValue = existing.toObject();
    const data = beforeUpdate ? await beforeUpdate(req.body, existing, req) : req.body;

    Object.assign(existing, data);
    await existing.save();

    await recordAudit(req, {
      action: AUDIT_ACTIONS.UPDATE,
      module: moduleName,
      entityId: existing._id,
      entityModel: moduleName,
      oldValue,
      newValue: existing.toObject(),
    });

    return sendSuccess(res, { message: `${moduleName} updated`, data: existing });
  });

  const remove = asyncHandler(async (req, res) => {
    const existing = await Model.findById(req.params.id);
    if (!existing) throw ApiError.notFound(`${moduleName} not found`);

    for (const dep of dependents) {
      const count = await dep.Model.countDocuments({ [dep.field]: existing._id });
      if (count > 0) {
        throw ApiError.conflict(
          `Cannot delete this ${moduleName.toLowerCase()} - it is referenced by ${count} ${dep.label}`
        );
      }
    }

    await existing.deleteOne();

    await recordAudit(req, {
      action: AUDIT_ACTIONS.DELETE,
      module: moduleName,
      entityId: existing._id,
      entityModel: moduleName,
      oldValue: existing.toObject(),
    });

    return sendSuccess(res, { message: `${moduleName} deleted` });
  });

  return { list, getById, create, update, remove };
}
