import { useState, useEffect, type FormEvent } from 'react';
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Save,
  Check,
  ShieldCheck,
  Tag,
  Package,
  ConciergeBell,
  MapPin,
  X,
} from 'lucide-react';
import type { Business } from '../../types/business';
import {
  BUSINESS_KNOWLEDGE_LIMITS,
  type BusinessProductItem,
  type BusinessServiceItem,
} from '../../types/businessKnowledge';
import { validateBusinessKnowledgeInput } from '../../utils/businessKnowledgeValidation';
import { businessRepository } from '../../services/storage';
import { Button } from '../common/Button';
import { Alert } from '../common/Alert';

interface Props {
  business: Business;
}

export function BusinessKnowledgeSettings({ business }: Props) {
  const [description, setDescription] = useState<string>('');
  const [primaryCategory, setPrimaryCategory] = useState<string>(
    business.category,
  );
  const [additionalInfo, setAdditionalInfo] = useState<string>('');
  const [targetKeywords, setTargetKeywords] = useState<string[]>([]);
  const [products, setProducts] = useState<BusinessProductItem[]>([]);
  const [services, setServices] = useState<BusinessServiceItem[]>([]);
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);

  // Inline add/edit states for Keywords
  const [keywordDraft, setKeywordDraft] = useState<string>('');
  const [editingKeywordIndex, setEditingKeywordIndex] = useState<number | null>(
    null,
  );

  // Inline add/edit states for Products
  const [productNameDraft, setProductNameDraft] = useState<string>('');
  const [productDescDraft, setProductDescDraft] = useState<string>('');
  const [productCategoryDraft, setProductCategoryDraft] = useState<string>('');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Inline add/edit states for Services
  const [serviceNameDraft, setServiceNameDraft] = useState<string>('');
  const [serviceDescDraft, setServiceDescDraft] = useState<string>('');
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  // Inline add/edit states for Service Areas
  const [areaDraft, setAreaDraft] = useState<string>('');
  const [editingAreaIndex, setEditingAreaIndex] = useState<number | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const profile = await businessRepository.getBusinessKnowledge(
          business.id,
        );
        if (!active) return;
        setDescription(profile.description);
        setPrimaryCategory(profile.primaryCategory || business.category);
        setAdditionalInfo(profile.additionalInfo);
        setTargetKeywords(profile.targetKeywords);
        setProducts(profile.products);
        setServices(profile.services);
        setServiceAreas(profile.serviceAreas);
      } catch (err) {
        if (!active) return;
        setError(
          (err as Error).message ||
            'Failed to load business knowledge configuration.',
        );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [business.id, business.category]);

  // --- Keyword handlers ---
  function handleAddOrUpdateKeyword() {
    setError(null);
    const cleaned = keywordDraft.trim().replace(/\s+/g, ' ');
    if (!cleaned) return;

    if (
      cleaned.length < BUSINESS_KNOWLEDGE_LIMITS.KEYWORD_MIN_LENGTH ||
      cleaned.length > BUSINESS_KNOWLEDGE_LIMITS.KEYWORD_MAX_LENGTH
    ) {
      setError(
        `Keyword must be between ${BUSINESS_KNOWLEDGE_LIMITS.KEYWORD_MIN_LENGTH} and ${BUSINESS_KNOWLEDGE_LIMITS.KEYWORD_MAX_LENGTH} characters.`,
      );
      return;
    }

    const dupIndex = targetKeywords.findIndex(
      (kw, idx) =>
        idx !== editingKeywordIndex &&
        kw.toLowerCase() === cleaned.toLowerCase(),
    );
    if (dupIndex !== -1) {
      setError(`Duplicate keyword "${cleaned}" is already in the list.`);
      return;
    }

    if (editingKeywordIndex !== null) {
      setTargetKeywords((prev) =>
        prev.map((kw, idx) => (idx === editingKeywordIndex ? cleaned : kw)),
      );
      setEditingKeywordIndex(null);
    } else {
      if (
        targetKeywords.length >= BUSINESS_KNOWLEDGE_LIMITS.MAX_TARGET_KEYWORDS
      ) {
        setError(
          `Maximum of ${BUSINESS_KNOWLEDGE_LIMITS.MAX_TARGET_KEYWORDS} keywords reached.`,
        );
        return;
      }
      setTargetKeywords((prev) => [...prev, cleaned]);
    }
    setKeywordDraft('');
  }

  function handleRemoveKeyword(idx: number) {
    setTargetKeywords((prev) => prev.filter((_, i) => i !== idx));
    if (editingKeywordIndex === idx) {
      setEditingKeywordIndex(null);
      setKeywordDraft('');
    }
  }

  // --- Product handlers ---
  function handleAddOrUpdateProduct() {
    setError(null);
    const name = productNameDraft.trim().replace(/\s+/g, ' ');
    const desc = productDescDraft.trim();
    const cat = productCategoryDraft.trim().replace(/\s+/g, ' ');

    if (!name) {
      setError('Product name is required.');
      return;
    }

    const dup = products.find(
      (p) =>
        p.id !== editingProductId &&
        p.name.toLowerCase() === name.toLowerCase(),
    );
    if (dup) {
      setError(`Duplicate product "${name}" already exists.`);
      return;
    }

    if (editingProductId) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === editingProductId
            ? {
                ...p,
                name,
                description: desc,
                ...(cat ? { category: cat } : { category: undefined }),
              }
            : p,
        ),
      );
      setEditingProductId(null);
    } else {
      if (products.length >= BUSINESS_KNOWLEDGE_LIMITS.MAX_PRODUCTS) {
        setError(
          `Maximum of ${BUSINESS_KNOWLEDGE_LIMITS.MAX_PRODUCTS} products reached.`,
        );
        return;
      }
      setProducts((prev) => [
        ...prev,
        {
          id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name,
          description: desc,
          ...(cat ? { category: cat } : {}),
        },
      ]);
    }
    setProductNameDraft('');
    setProductDescDraft('');
    setProductCategoryDraft('');
  }

  function handleEditProduct(item: BusinessProductItem) {
    setEditingProductId(item.id);
    setProductNameDraft(item.name);
    setProductDescDraft(item.description);
    setProductCategoryDraft(item.category ?? '');
  }

  function handleDeleteProduct(id: string) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    if (editingProductId === id) {
      setEditingProductId(null);
      setProductNameDraft('');
      setProductDescDraft('');
      setProductCategoryDraft('');
    }
  }

  // --- Service handlers ---
  function handleAddOrUpdateService() {
    setError(null);
    const name = serviceNameDraft.trim().replace(/\s+/g, ' ');
    const desc = serviceDescDraft.trim();

    if (!name) {
      setError('Service name is required.');
      return;
    }

    const dup = services.find(
      (s) =>
        s.id !== editingServiceId &&
        s.name.toLowerCase() === name.toLowerCase(),
    );
    if (dup) {
      setError(`Duplicate service "${name}" already exists.`);
      return;
    }

    if (editingServiceId) {
      setServices((prev) =>
        prev.map((s) =>
          s.id === editingServiceId ? { ...s, name, description: desc } : s,
        ),
      );
      setEditingServiceId(null);
    } else {
      if (services.length >= BUSINESS_KNOWLEDGE_LIMITS.MAX_SERVICES) {
        setError(
          `Maximum of ${BUSINESS_KNOWLEDGE_LIMITS.MAX_SERVICES} services reached.`,
        );
        return;
      }
      setServices((prev) => [
        ...prev,
        {
          id: `svc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name,
          description: desc,
        },
      ]);
    }
    setServiceNameDraft('');
    setServiceDescDraft('');
  }

  function handleEditService(item: BusinessServiceItem) {
    setEditingServiceId(item.id);
    setServiceNameDraft(item.name);
    setServiceDescDraft(item.description);
  }

  function handleDeleteService(id: string) {
    setServices((prev) => prev.filter((s) => s.id !== id));
    if (editingServiceId === id) {
      setEditingServiceId(null);
      setServiceNameDraft('');
      setServiceDescDraft('');
    }
  }

  // --- Service Area handlers ---
  function handleAddOrUpdateArea() {
    setError(null);
    const cleaned = areaDraft.trim().replace(/\s+/g, ' ');
    if (!cleaned) return;

    if (
      cleaned.length < BUSINESS_KNOWLEDGE_LIMITS.SERVICE_AREA_MIN_LENGTH ||
      cleaned.length > BUSINESS_KNOWLEDGE_LIMITS.SERVICE_AREA_MAX_LENGTH
    ) {
      setError(
        `Service area must be between ${BUSINESS_KNOWLEDGE_LIMITS.SERVICE_AREA_MIN_LENGTH} and ${BUSINESS_KNOWLEDGE_LIMITS.SERVICE_AREA_MAX_LENGTH} characters.`,
      );
      return;
    }

    const dupIndex = serviceAreas.findIndex(
      (area, idx) =>
        idx !== editingAreaIndex &&
        area.toLowerCase() === cleaned.toLowerCase(),
    );
    if (dupIndex !== -1) {
      setError(`Duplicate service area "${cleaned}" is already in the list.`);
      return;
    }

    if (editingAreaIndex !== null) {
      setServiceAreas((prev) =>
        prev.map((area, idx) => (idx === editingAreaIndex ? cleaned : area)),
      );
      setEditingAreaIndex(null);
    } else {
      if (serviceAreas.length >= BUSINESS_KNOWLEDGE_LIMITS.MAX_SERVICE_AREAS) {
        setError(
          `Maximum of ${BUSINESS_KNOWLEDGE_LIMITS.MAX_SERVICE_AREAS} service areas reached.`,
        );
        return;
      }
      setServiceAreas((prev) => [...prev, cleaned]);
    }
    setAreaDraft('');
  }

  function handleRemoveArea(idx: number) {
    setServiceAreas((prev) => prev.filter((_, i) => i !== idx));
    if (editingAreaIndex === idx) {
      setEditingAreaIndex(null);
      setAreaDraft('');
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedBanner(null);

    const validation = validateBusinessKnowledgeInput(business.id, {
      description,
      primaryCategory,
      additionalInfo,
      targetKeywords,
      products,
      services,
      serviceAreas,
    });

    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setSaving(true);
    try {
      const updated = await businessRepository.updateBusinessKnowledge(
        business.id,
        validation.value,
      );
      setDescription(updated.description);
      setPrimaryCategory(updated.primaryCategory);
      setAdditionalInfo(updated.additionalInfo);
      setTargetKeywords(updated.targetKeywords);
      setProducts(updated.products);
      setServices(updated.services);
      setServiceAreas(updated.serviceAreas);
      setSavedBanner(
        'Business Knowledge & Local SEO profile saved for this business.',
      );
    } catch (err) {
      setError(
        (err as Error).message || 'Failed to save Business Knowledge profile.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-6 shadow-2xs space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DDE4DC] pb-4">
        <div>
          <h3 className="text-[18px] font-semibold tracking-tight text-[#252B29] flex items-center gap-2 sm:text-[20px]">
            <BookOpen className="h-5 w-5 text-[#244B40]" aria-hidden />
            Business Knowledge &amp; Local SEO Context
          </h3>
          <p className="mt-1 text-[13px] text-[#626B65]">
            Configure factual business description, target keywords, products, services, and service areas for{' '}
            <strong className="text-[#252B29]">{business.name}</strong>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#626B65] font-mono">
          <span>Business ID:</span>
          <span className="bg-[#F7F7F2] border border-[#DDE4DC] px-2 py-0.5 rounded text-[#252B29] font-bold">
            {business.id}
          </span>
        </div>
      </div>

      {/* Customer Review Protection Notice */}
      <div className="flex items-start gap-2.5 rounded-xl bg-[#EEF3EC] border border-[#A8BFA5] p-3.5 text-[13px] text-[#252B29]">
        <ShieldCheck className="h-4 w-4 text-[#244B40] shrink-0 mt-0.5" aria-hidden />
        <div className="space-y-1">
          <p className="font-semibold text-[#252B29]">
            Selective Context &amp; Customer Review Protection
          </p>
          <p className="text-[#626B65] leading-relaxed">
            Business knowledge is selectively matched only when relevant to{' '}
            <strong className="text-[#252B29]">Business-Owner AI Responses</strong>. It is{' '}
            <strong className="text-[#252B29]">never</strong> injected into customer reviews on{' '}
            <code>/r/{business.slug}</code>, and never used to claim a customer purchased a product, used a service, or visited a location they did not mention.
          </p>
        </div>
      </div>

      {savedBanner && (
        <Alert tone="success">
          <p>{savedBanner}</p>
        </Alert>
      )}

      {error && (
        <Alert tone="error">
          <p>{error}</p>
        </Alert>
      )}

      {loading ? (
        <div className="py-8 text-center text-[13px] text-[#626B65]">
          Loading business knowledge profile...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* A. Business Description, Category & Additional Info */}
          <div className="space-y-4 rounded-xl border border-[#DDE4DC] bg-[#F7F7F2] p-4">
            <h4 className="text-[15px] font-semibold text-[#252B29]">
              A. Business Description &amp; Category
            </h4>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="bk-description"
                  className="block text-[13px] font-medium text-[#252B29]"
                >
                  Business Description *
                </label>
                <span className="text-[12px] font-mono text-[#626B65]">
                  {description.length} /{' '}
                  {BUSINESS_KNOWLEDGE_LIMITS.DESCRIPTION_MAX_LENGTH}
                </span>
              </div>
              <textarea
                id="bk-description"
                rows={2}
                maxLength={BUSINESS_KNOWLEDGE_LIMITS.DESCRIPTION_MAX_LENGTH}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="We are a vegetarian restaurant serving traditional South Indian food in Hyderabad."
                className="w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2.5 text-[14px] text-[#252B29] focus:border-[#244B40] focus:outline-none focus:ring-2 focus:ring-[#244B40]/20"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="bk-category"
                  className="block text-[13px] font-medium text-[#252B29]"
                >
                  Business Category *
                </label>
                <input
                  id="bk-category"
                  type="text"
                  maxLength={
                    BUSINESS_KNOWLEDGE_LIMITS.PRIMARY_CATEGORY_MAX_LENGTH
                  }
                  value={primaryCategory}
                  onChange={(e) => setPrimaryCategory(e.target.value)}
                  placeholder="Vegetarian South Indian Restaurant"
                  className="min-h-11 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2 text-[14px] text-[#252B29] focus:border-[#244B40] focus:outline-none focus:ring-2 focus:ring-[#244B40]/20"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="bk-additional"
                    className="block text-[13px] font-medium text-[#252B29]"
                  >
                    Optional Additional Information
                  </label>
                  <span className="text-[12px] font-mono text-[#626B65]">
                    {additionalInfo.length} /{' '}
                    {BUSINESS_KNOWLEDGE_LIMITS.ADDITIONAL_INFO_MAX_LENGTH}
                  </span>
                </div>
                <input
                  id="bk-additional"
                  type="text"
                  maxLength={
                    BUSINESS_KNOWLEDGE_LIMITS.ADDITIONAL_INFO_MAX_LENGTH
                  }
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  placeholder="Family dining, open 7 AM – 11 PM daily"
                  className="min-h-11 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2 text-[14px] text-[#252B29] focus:border-[#244B40] focus:outline-none focus:ring-2 focus:ring-[#244B40]/20"
                />
              </div>
            </div>
          </div>

          {/* B. Target Keywords */}
          <div className="space-y-3 rounded-xl border border-[#DDE4DC] bg-[#F7F7F2] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-[15px] font-semibold text-[#252B29] flex items-center gap-1.5">
                <Tag className="h-4 w-4 text-[#244B40]" aria-hidden />
                B. Target Keywords ({targetKeywords.length}/
                {BUSINESS_KNOWLEDGE_LIMITS.MAX_TARGET_KEYWORDS})
              </h4>
              <span className="text-[12px] text-[#626B65]">
                Used selectively when relevant; never auto-stuffed.
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                aria-label="Target keyword"
                maxLength={BUSINESS_KNOWLEDGE_LIMITS.KEYWORD_MAX_LENGTH}
                value={keywordDraft}
                onChange={(e) => setKeywordDraft(e.target.value)}
                placeholder="e.g., Vegetarian restaurant in Hyderabad, South Indian food, Best dosa near Madhapur"
                className="flex-1 min-w-[220px] min-h-11 rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2 text-[14px] text-[#252B29]"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleAddOrUpdateKeyword}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                {editingKeywordIndex !== null ? 'Update Keyword' : 'Add Keyword'}
              </Button>
              {editingKeywordIndex !== null && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditingKeywordIndex(null);
                    setKeywordDraft('');
                  }}
                >
                  <X className="h-3.5 w-3.5" aria-hidden /> Cancel
                </Button>
              )}
            </div>

            {targetKeywords.length === 0 ? (
              <p className="text-[13px] text-[#626B65] italic">
                No target keywords configured yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {targetKeywords.map((kw, idx) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#DDE4DC] bg-[#FFFFFF] px-3 py-1 text-[13px] font-medium text-[#252B29]"
                  >
                    {kw}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingKeywordIndex(idx);
                        setKeywordDraft(kw);
                      }}
                      title="Edit keyword"
                      aria-label={`Edit keyword ${kw}`}
                      className="text-[#626B65] hover:text-[#244B40] cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(idx)}
                      title="Remove keyword"
                      aria-label={`Remove keyword ${kw}`}
                      className="text-[#626B65] hover:text-red-700 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* C. Products */}
          <div className="space-y-3 rounded-xl border border-[#DDE4DC] bg-[#F7F7F2] p-4">
            <h4 className="text-[15px] font-semibold text-[#252B29] flex items-center gap-1.5">
              <Package className="h-4 w-4 text-[#244B40]" aria-hidden />
              C. Products ({products.length}/
              {BUSINESS_KNOWLEDGE_LIMITS.MAX_PRODUCTS})
            </h4>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                type="text"
                aria-label="Product name"
                maxLength={BUSINESS_KNOWLEDGE_LIMITS.PRODUCT_NAME_MAX_LENGTH}
                value={productNameDraft}
                onChange={(e) => setProductNameDraft(e.target.value)}
                placeholder="Product name (e.g., Masala dosa)"
                className="min-h-11 rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2 text-[14px] text-[#252B29]"
              />
              <input
                type="text"
                aria-label="Product description"
                maxLength={
                  BUSINESS_KNOWLEDGE_LIMITS.PRODUCT_DESCRIPTION_MAX_LENGTH
                }
                value={productDescDraft}
                onChange={(e) => setProductDescDraft(e.target.value)}
                placeholder="Short description (e.g., Crispy crepe with potato)"
                className="min-h-11 rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2 text-[14px] text-[#252B29]"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  aria-label="Product category"
                  maxLength={
                    BUSINESS_KNOWLEDGE_LIMITS.PRODUCT_CATEGORY_MAX_LENGTH
                  }
                  value={productCategoryDraft}
                  onChange={(e) => setProductCategoryDraft(e.target.value)}
                  placeholder="Optional category (e.g., Breakfast)"
                  className="flex-1 min-h-11 rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2 text-[14px] text-[#252B29]"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleAddOrUpdateProduct}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  {editingProductId ? 'Update' : 'Add'}
                </Button>
              </div>
            </div>

            {products.length === 0 ? (
              <p className="text-[13px] text-[#626B65] italic">
                No products configured yet.
              </p>
            ) : (
              <div className="divide-y divide-[#DDE4DC] rounded-xl border border-[#DDE4DC] bg-[#FFFFFF]">
                {products.map((prod) => (
                  <div
                    key={prod.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px]"
                  >
                    <div>
                      <span className="font-semibold text-[#252B29]">
                        {prod.name}
                      </span>
                      {prod.category && (
                        <span className="ml-2 rounded border border-[#DDE4DC] bg-[#F7F7F2] px-2 py-0.5 text-[11px] font-medium text-[#626B65]">
                          {prod.category}
                        </span>
                      )}
                      {prod.description && (
                        <span className="ml-2 text-[#626B65]">
                          — {prod.description}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        aria-label={`Edit product ${prod.name}`}
                        onClick={() => handleEditProduct(prod)}
                        className="text-[#626B65] hover:text-[#244B40] cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete product ${prod.name}`}
                        onClick={() => handleDeleteProduct(prod.id)}
                        className="text-[#626B65] hover:text-red-700 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* D. Services */}
          <div className="space-y-3 rounded-xl border border-[#DDE4DC] bg-[#F7F7F2] p-4">
            <h4 className="text-[15px] font-semibold text-[#252B29] flex items-center gap-1.5">
              <ConciergeBell className="h-4 w-4 text-[#244B40]" aria-hidden />
              D. Services ({services.length}/
              {BUSINESS_KNOWLEDGE_LIMITS.MAX_SERVICES})
            </h4>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                type="text"
                aria-label="Service name"
                maxLength={BUSINESS_KNOWLEDGE_LIMITS.SERVICE_NAME_MAX_LENGTH}
                value={serviceNameDraft}
                onChange={(e) => setServiceNameDraft(e.target.value)}
                placeholder="Service name (e.g., Home delivery, Catering)"
                className="min-h-11 rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2 text-[14px] text-[#252B29]"
              />
              <div className="sm:col-span-2 flex gap-2">
                <input
                  type="text"
                  aria-label="Service description"
                  maxLength={
                    BUSINESS_KNOWLEDGE_LIMITS.SERVICE_DESCRIPTION_MAX_LENGTH
                  }
                  value={serviceDescDraft}
                  onChange={(e) => setServiceDescDraft(e.target.value)}
                  placeholder="Short description (e.g., Outdoor & corporate event catering)"
                  className="flex-1 min-h-11 rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2 text-[14px] text-[#252B29]"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleAddOrUpdateService}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  {editingServiceId ? 'Update' : 'Add'}
                </Button>
              </div>
            </div>

            {services.length === 0 ? (
              <p className="text-[13px] text-[#626B65] italic">
                No services configured yet.
              </p>
            ) : (
              <div className="divide-y divide-[#DDE4DC] rounded-xl border border-[#DDE4DC] bg-[#FFFFFF]">
                {services.map((svc) => (
                  <div
                    key={svc.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px]"
                  >
                    <div>
                      <span className="font-semibold text-[#252B29]">
                        {svc.name}
                      </span>
                      {svc.description && (
                        <span className="ml-2 text-[#626B65]">
                          — {svc.description}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        aria-label={`Edit service ${svc.name}`}
                        onClick={() => handleEditService(svc)}
                        className="text-[#626B65] hover:text-[#244B40] cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete service ${svc.name}`}
                        onClick={() => handleDeleteService(svc.id)}
                        className="text-[#626B65] hover:text-red-700 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* E. Service Areas */}
          <div className="space-y-3 rounded-xl border border-[#DDE4DC] bg-[#F7F7F2] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-[15px] font-semibold text-[#252B29] flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-[#244B40]" aria-hidden />
                E. Service Areas ({serviceAreas.length}/
                {BUSINESS_KNOWLEDGE_LIMITS.MAX_SERVICE_AREAS})
              </h4>
              <span className="text-[12px] text-[#626B65]">
                Explicit locations served (never inferred automatically).
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                aria-label="Service area"
                maxLength={BUSINESS_KNOWLEDGE_LIMITS.SERVICE_AREA_MAX_LENGTH}
                value={areaDraft}
                onChange={(e) => setAreaDraft(e.target.value)}
                placeholder="e.g., Hyderabad, Madhapur, Gachibowli, Kondapur"
                className="flex-1 min-w-[220px] min-h-11 rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2 text-[14px] text-[#252B29]"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleAddOrUpdateArea}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                {editingAreaIndex !== null ? 'Update Area' : 'Add Service Area'}
              </Button>
            </div>

            {serviceAreas.length === 0 ? (
              <p className="text-[13px] text-[#626B65] italic">
                No service areas configured yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {serviceAreas.map((area, idx) => (
                  <span
                    key={area}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#DDE4DC] bg-[#FFFFFF] px-3 py-1 text-[13px] font-medium text-[#252B29]"
                  >
                    {area}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAreaIndex(idx);
                        setAreaDraft(area);
                      }}
                      title="Edit service area"
                      aria-label={`Edit service area ${area}`}
                      className="text-[#626B65] hover:text-[#244B40] cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveArea(idx)}
                      title="Remove service area"
                      aria-label={`Remove service area ${area}`}
                      className="text-[#626B65] hover:text-red-700 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end border-t border-[#DDE4DC] pt-4">
            <Button type="submit" loading={saving}>
              {savedBanner ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Save className="h-4 w-4" aria-hidden />
              )}
              Save Business Knowledge
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
