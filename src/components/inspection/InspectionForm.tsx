'use client';

import { useState } from 'react';
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField';
import { Card } from '@/components/ui/Card';
import type { InspectionFormData, ProductCategory } from '@/types';

interface InspectionFormProps {
  formData: InspectionFormData;
  onChange: (data: InspectionFormData) => void;
  confidence?: Record<string, number>;
  extractionMethod?: 'manual' | 'demo' | 'ocr' | 'vision-lm';
  statusMessage?: string;
  extractionDiagnostics?: any;
  sourceMap?: Record<string, string>; // Field-level extraction source: 'ocr', 'ai', 'ocr+ai', 'manual'
  metadata?: Record<string, any>; // FieldExtractionMeta
}

export function InspectionForm({
  formData,
  onChange,
  confidence = {},
  extractionMethod = 'manual',
  statusMessage = '',
  extractionDiagnostics,
  sourceMap = {},
  metadata = {},
}: InspectionFormProps) {
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const update = <K extends keyof InspectionFormData>(
    key: K,
    value: InspectionFormData[K]
  ) => {
    const updated = { ...formData, [key]: value };
    // Auto-set cosmeticOrigin.applicable when category changes
    if (key === 'category') {
      updated.cosmeticOrigin = {
        ...updated.cosmeticOrigin,
        applicable: value === 'cosmetics',
      };
    }
    onChange(updated);
  };

  const updateNested = <
    K extends keyof InspectionFormData,
    SK extends keyof NonNullable<InspectionFormData[K]>
  >(
    key: K,
    subKey: SK,
    value: NonNullable<InspectionFormData[K]>[SK]
  ) => {
    const current = formData[key];
    if (current && typeof current === 'object') {
      onChange({
        ...formData,
        [key]: { ...current, [subKey]: value } as InspectionFormData[K],
      });
    }
  };

  const fieldCount = Object.keys(confidence).length;

  return (
    <div className="space-y-6">
      {/* Extraction Status Banner */}
      {extractionMethod === 'vision-lm' ? (
        fieldCount > 0 ? (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-purple-50 border border-purple-200 rounded-lg">
            <span className="text-xs font-semibold text-purple-800 bg-purple-100 px-2 py-0.5 rounded shrink-0">
              ✨ Vision AI + OCR ({fieldCount} fields)
            </span>
            <span className="text-xs text-purple-700">
              {statusMessage || `Vision AI and OCR detected ${fieldCount} fields. Please review and correct any values below before running compliance checks.`}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
            <span className="text-xs font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded shrink-0">
              ⚠️ Vision AI Completed (No Fields Confident)
            </span>
            <span className="text-xs text-amber-700">
              {statusMessage || 'Vision AI processed the images, but could not confidently identify label fields. Please review and enter details manually.'}
            </span>
          </div>
        )
      ) : extractionMethod === 'ocr' ? (
        fieldCount > 0 ? (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
            <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded shrink-0">
              🔍 OCR Extracted ({fieldCount} fields)
            </span>
            <span className="text-xs text-emerald-700">
              {statusMessage || `OCR detected ${fieldCount} fields. Please review and correct any errors below before running compliance checks.`}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
            <span className="text-xs font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded shrink-0">
              ⚠️ OCR Completed (No Fields Confident)
            </span>
            <span className="text-xs text-amber-700">
              {statusMessage || 'OCR detected text, but could not confidently identify label fields. Please review the label and enter details manually.'}
            </span>
          </div>
        )
      ) : extractionMethod === 'demo' ? (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-sky-50 border border-sky-200 rounded-lg">
          <span className="text-xs font-semibold text-sky-800 bg-sky-100 px-2 py-0.5 rounded shrink-0">
            🎯 Demo Sample Mode
          </span>
          <span className="text-xs text-sky-700">
            Simulated OCR extraction loaded. Demonstrates human-in-the-loop review workflow.
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-navy-50 border border-navy-200 rounded-lg">
          <span className="text-xs font-semibold text-navy-600 bg-navy-100 px-2 py-0.5 rounded shrink-0">
            ✍️ Manual Entry Mode
          </span>
          <span className="text-xs text-navy-500">
            {statusMessage || 'Manual data entry active. Capture label images to auto-populate via client-side OCR.'}
          </span>
        </div>
      )}

      {/* Section: Basic Product Info */}
      <Card>
        <h3 className="text-base font-semibold text-navy-900 mb-4">Product Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Product Name"
            required
            confidence={confidence['productName']}
            source={sourceMap['productName']}
            metadata={metadata['productName']}
          >
            <Input
              value={formData.productName}
              onChange={(e) => update('productName', e.target.value)}
              placeholder="e.g. SparkleClean Surface Cleaner"
            />
          </FormField>

          <FormField
            label="Common / Generic Name"
            hint="Separate from brand name where possible"
            confidence={confidence['commonGenericName']}
            source={sourceMap['commonGenericName']}
            metadata={metadata['commonGenericName']}
          >
            <Input
              value={formData.commonGenericName}
              onChange={(e) => update('commonGenericName', e.target.value)}
              placeholder="e.g. All-Purpose Surface Cleaner"
            />
          </FormField>

          <FormField
            label="Brand"
            confidence={confidence['brand']}
            source={sourceMap['brand']}
            metadata={metadata['brand']}
          >
            <Input
              value={formData.brand}
              onChange={(e) => update('brand', e.target.value)}
              placeholder="e.g. SparkleClean"
            />
          </FormField>

          <FormField label="Category (Manual Selection)" required>
            <Select
              value={formData.category}
              onChange={(e) => update('category', e.target.value as ProductCategory)}
            >
              <option value="general">General Packaged Commodity</option>
              <option value="food">Food Product</option>
              <option value="cosmetics">Cosmetics</option>
              <option value="garments">Garments / Textiles</option>
              <option value="household">Household Product</option>
              <option value="electronics">Electronics / Appliances</option>
            </Select>
          </FormField>

          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isImported}
                onChange={(e) => update('isImported', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-navy-600 focus:ring-navy-500"
              />
              <span className="text-sm text-gray-700">This is an imported product (Manual Confirmation)</span>
            </label>
          </div>
        </div>
      </Card>

      {/* Section: Applicability */}
      <Card>
        <h3 className="text-base font-semibold text-navy-900 mb-1">Applicability Check</h3>
        <p className="text-xs text-gray-500 mb-4">
          Determines whether LMPC Rules apply. Based on Rule 3 exclusions.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Is this a retail package?">
            <Select
              value={formData.applicability.isRetailPackage === null ? '' : formData.applicability.isRetailPackage ? 'yes' : 'no'}
              onChange={(e) => {
                const v = e.target.value;
                updateNested('applicability', 'isRetailPackage', v === '' ? null : v === 'yes');
              }}
            >
              <option value="">— Select —</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Select>
          </FormField>

          <FormField label="Sold directly to consumer?">
            <Select
              value={formData.applicability.soldDirectlyToConsumer === null ? '' : formData.applicability.soldDirectlyToConsumer ? 'yes' : 'no'}
              onChange={(e) => {
                const v = e.target.value;
                updateNested('applicability', 'soldDirectlyToConsumer', v === '' ? null : v === 'yes');
              }}
            >
              <option value="">— Select —</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Select>
          </FormField>

          <FormField label="Package weight (kg)" hint="Leave blank if not by weight">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={formData.applicability.quantityKg ?? ''}
              onChange={(e) =>
                updateNested('applicability', 'quantityKg', e.target.value ? parseFloat(e.target.value) : null)
              }
            />
          </FormField>

          <FormField label="Package volume (litres)" hint="Leave blank if not by volume">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={formData.applicability.quantityLitre ?? ''}
              onChange={(e) =>
                updateNested('applicability', 'quantityLitre', e.target.value ? parseFloat(e.target.value) : null)
              }
            />
          </FormField>

          <div className="sm:col-span-2 space-y-2">
            <p className="text-sm font-medium text-gray-700">Rule 3 Exclusion Categories:</p>
            {[
              { key: 'isCement' as const, label: 'Cement' },
              { key: 'isFertiliser' as const, label: 'Fertiliser' },
              { key: 'isAgriculturalFarmProduce' as const, label: 'Agricultural farm produce' },
              { key: 'isIndustrialConsumerPackage' as const, label: 'Industrial-consumer package' },
              { key: 'isInstitutionalConsumerPackage' as const, label: 'Institutional-consumer package' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.applicability[key]}
                  onChange={(e) => updateNested('applicability', key, e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-navy-600 focus:ring-navy-500"
                />
                <span className="text-sm text-gray-600">{label}</span>
              </label>
            ))}
          </div>
        </div>
      </Card>

      {/* Section: MRP & Net Quantity */}
      <Card>
        <h3 className="text-base font-semibold text-navy-900 mb-4">Price & Quantity</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="MRP (₹)"
            required
            hint="Maximum Retail Price in Indian currency"
            confidence={confidence['mrp.value']}
            source={sourceMap['mrp']}
            metadata={metadata['mrp']}
          >
            <Input
              type="number"
              step="0.01"
              min="0"
              value={formData.mrp.value ?? ''}
              onChange={(e) =>
                updateNested('mrp', 'value', e.target.value ? parseFloat(e.target.value) : null)
              }
              placeholder="e.g. 149.00"
            />
          </FormField>

          <div className="space-y-2 flex flex-col justify-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.mrp.inclusiveOfAllTaxes === true}
                onChange={(e) => updateNested('mrp', 'inclusiveOfAllTaxes', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-navy-600 focus:ring-navy-500"
              />
              <span className="text-sm text-gray-700">
                MRP is inclusive of all taxes
                {confidence['mrp.inclusiveOfAllTaxes'] ? (
                  <span className="ml-2 px-1.5 py-0.5 text-xs rounded border bg-emerald-50 text-emerald-700 border-emerald-200">
                    OCR: {confidence['mrp.inclusiveOfAllTaxes']}%
                  </span>
                ) : null}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.mrp.exemptionDeclared}
                onChange={(e) => updateNested('mrp', 'exemptionDeclared', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-navy-600 focus:ring-navy-500"
              />
              <span className="text-sm text-gray-600">MRP exemption declared</span>
            </label>
          </div>

          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={formData.netQuantity.soldByNumber}
                onChange={(e) => updateNested('netQuantity', 'soldByNumber', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-navy-600 focus:ring-navy-500"
              />
              <span className="text-sm text-gray-700">Sold by number (count of items)</span>
            </label>
          </div>

          {formData.netQuantity.soldByNumber ? (
            <FormField
              label="Number of Items"
              required
              confidence={confidence['netQuantity.itemCount']}
            >
              <Input
                type="number"
                min="1"
                value={formData.netQuantity.itemCount ?? ''}
                onChange={(e) =>
                  updateNested('netQuantity', 'itemCount', e.target.value ? parseInt(e.target.value) : null)
                }
                placeholder="e.g. 6"
              />
            </FormField>
          ) : (
            <>
              <FormField
                label="Net Quantity"
                required
                confidence={confidence['netQuantity.value']}
                source={sourceMap['netQuantity']}
                metadata={metadata['netQuantity']}
              >
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.netQuantity.value ?? ''}
                  onChange={(e) =>
                    updateNested('netQuantity', 'value', e.target.value ? parseFloat(e.target.value) : null)
                  }
                  placeholder="e.g. 500"
                />
              </FormField>

              <FormField
                label="Unit"
                required
                hint="g, kg, ml, L, cm, m, pieces"
                confidence={confidence['netQuantity.unit']}
              >
                <Select
                  value={formData.netQuantity.unit}
                  onChange={(e) => updateNested('netQuantity', 'unit', e.target.value)}
                >
                  <option value="">— Select unit —</option>
                  <option value="g">g (grams)</option>
                  <option value="kg">kg (kilograms)</option>
                  <option value="ml">ml (millilitres)</option>
                  <option value="L">L (litres)</option>
                  <option value="cm">cm (centimetres)</option>
                  <option value="m">m (metres)</option>
                  <option value="pieces">Pieces</option>
                </Select>
              </FormField>
            </>
          )}
        </div>
      </Card>

      {/* Section: Manufacturer & Importer */}
      <Card>
        <h3 className="text-base font-semibold text-navy-900 mb-4">Manufacturer / Packer</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Name"
            required
            confidence={confidence['manufacturer.name']}
            source={sourceMap['manufacturer']}
            metadata={metadata['manufacturer.name']}
          >
            <Input
              value={formData.manufacturer.name}
              onChange={(e) => updateNested('manufacturer', 'name', e.target.value)}
              placeholder="Manufacturer / Packer name"
            />
          </FormField>
          <FormField
            label="Address"
            required
            confidence={confidence['manufacturer.address']}
            metadata={metadata['manufacturer.address']}
          >
            <Input
              value={formData.manufacturer.address}
              onChange={(e) => updateNested('manufacturer', 'address', e.target.value)}
              placeholder="Full address"
            />
          </FormField>
        </div>

        {formData.isImported && (
          <>
            <h4 className="text-sm font-semibold text-navy-800 mt-6 mb-3">Importer Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Importer Name"
                required
                confidence={confidence['importer.name']}
                source={sourceMap['importer']}
                metadata={metadata['importer.name']}
              >
                <Input
                  value={formData.importer.name}
                  onChange={(e) => updateNested('importer', 'name', e.target.value)}
                  placeholder="Indian importer name"
                />
              </FormField>
              <FormField
                label="Importer Address"
                required
                confidence={confidence['importer.address']}
                metadata={metadata['importer.address']}
              >
                <Input
                  value={formData.importer.address}
                  onChange={(e) => updateNested('importer', 'address', e.target.value)}
                  placeholder="Indian importer address"
                />
              </FormField>
              <FormField
                label="Country of Origin"
                required
                confidence={confidence['countryOfOrigin']}
                source={sourceMap['countryOfOrigin']}
                metadata={metadata['countryOfOrigin']}
              >
                <Input
                  value={formData.countryOfOrigin}
                  onChange={(e) => update('countryOfOrigin', e.target.value)}
                  placeholder="e.g. France, China, USA"
                />
              </FormField>
            </div>
          </>
        )}
      </Card>

      {/* Section: Dates */}
      <Card>
        <h3 className="text-base font-semibold text-navy-900 mb-4">Dates</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Manufacture Month"
            confidence={confidence['manufactureMonth']}
            source={sourceMap['manufactureMonth']}
            metadata={metadata['manufactureMonth']}
          >
            <Select
              value={formData.manufactureMonth}
              onChange={(e) => update('manufactureMonth', e.target.value)}
            >
              <option value="">— Month —</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
                  {new Date(2000, i).toLocaleString('en', { month: 'long' })}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Manufacture Year"
            confidence={confidence['manufactureYear']}
            source={sourceMap['manufactureYear']}
            metadata={metadata['manufactureYear']}
          >
            <Input
              type="number"
              min="2000"
              max="2030"
              value={formData.manufactureYear}
              onChange={(e) => update('manufactureYear', e.target.value)}
              placeholder="e.g. 2025"
            />
          </FormField>

          <div className="sm:col-span-2">
            <FormField
              label="Best-Before / Expiry Declaration Applicable"
              hint="Does the product declare a limited shelf life?"
              source={sourceMap['bestBefore']}
              metadata={metadata['bestBefore.month']}
            >
              <Select
                value={formData.bestBefore.applicable === null ? '' : formData.bestBefore.applicable ? 'yes' : 'no'}
                onChange={(e) => {
                  const v = e.target.value;
                  updateNested('bestBefore', 'applicable', v === '' ? null : v === 'yes');
                }}
              >
                <option value="">— Select —</option>
                <option value="yes">Yes — product may become unfit over time</option>
                <option value="no">No — not applicable to this product</option>
              </Select>
            </FormField>
          </div>

          {formData.bestBefore.applicable !== false && (
            <>
              <div className="sm:col-span-2">
                <FormField
                  label="Best Before / Shelf Life Statement"
                  hint="e.g. 'Best Before 12 Months from Packaging' or 'Use By 24 Months from Mfd'"
                  confidence={confidence['bestBefore.text']}
                  source={sourceMap['bestBefore']}
                  metadata={metadata['bestBefore.text']}
                >
                  <Input
                    value={formData.bestBefore.text || ''}
                    onChange={(e) => updateNested('bestBefore', 'text', e.target.value)}
                    placeholder="e.g. Best Before 12 Months from Packaging"
                  />
                </FormField>
              </div>
              <FormField
                label="Best Before / Use-By Day"
                hint="Optional"
                confidence={confidence['bestBefore.date']}
              >
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={formData.bestBefore.date}
                  onChange={(e) => updateNested('bestBefore', 'date', e.target.value)}
                  placeholder="DD"
                />
              </FormField>
              <FormField
                label="Best Before Month"
                required={formData.bestBefore.applicable === true && !formData.bestBefore.text?.trim()}
                confidence={confidence['bestBefore.month']}
                source={sourceMap['bestBefore']}
                metadata={metadata['bestBefore.month']}
              >
                <Select
                  value={formData.bestBefore.month}
                  onChange={(e) => updateNested('bestBefore', 'month', e.target.value)}
                >
                  <option value="">— Month —</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
                      {new Date(2000, i).toLocaleString('en', { month: 'long' })}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                label="Best Before Year"
                required={formData.bestBefore.applicable === true && !formData.bestBefore.text?.trim()}
                confidence={confidence['bestBefore.year']}
                source={sourceMap['bestBefore']}
                metadata={metadata['bestBefore.year']}
              >
                <Input
                  type="number"
                  min="2020"
                  max="2040"
                  value={formData.bestBefore.year}
                  onChange={(e) => updateNested('bestBefore', 'year', e.target.value)}
                  placeholder="e.g. 2027"
                />
              </FormField>
            </>
          )}
        </div>
      </Card>

      {/* Section: Consumer Care */}
      <Card>
        <h3 className="text-base font-semibold text-navy-900 mb-4">Consumer Care Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Contact Person / Office Name"
            confidence={confidence['consumerCare.contactName']}
            source={sourceMap['consumerCare']}
            metadata={metadata['consumerCare.contactName']}
          >
            <Input
              value={formData.consumerCare.contactName}
              onChange={(e) => updateNested('consumerCare', 'contactName', e.target.value)}
              placeholder="e.g. Customer Service Office"
            />
          </FormField>
          <FormField
            label="Address"
            confidence={confidence['consumerCare.address']}
            source={sourceMap['consumerCare']}
            metadata={metadata['consumerCare.address']}
          >
            <Input
              value={formData.consumerCare.address}
              onChange={(e) => updateNested('consumerCare', 'address', e.target.value)}
              placeholder="Consumer care address"
            />
          </FormField>
          <FormField
            label="Telephone Number"
            confidence={confidence['consumerCare.phone']}
            source={sourceMap['consumerCare']}
            metadata={metadata['consumerCare.phone']}
          >
            <Input
              type="tel"
              value={formData.consumerCare.phone}
              onChange={(e) => updateNested('consumerCare', 'phone', e.target.value)}
              placeholder="e.g. 1800-123-4567"
            />
          </FormField>
          <FormField
            label="Email Address"
            confidence={confidence['consumerCare.email']}
            source={sourceMap['consumerCare']}
            metadata={metadata['consumerCare.email']}
          >
            <Input
              type="email"
              value={formData.consumerCare.email}
              onChange={(e) => updateNested('consumerCare', 'email', e.target.value)}
              placeholder="e.g. care@example.in"
            />
          </FormField>
        </div>
      </Card>

      {/* Section: Dimensions */}
      <Card>
        <h3 className="text-base font-semibold text-navy-900 mb-4">Dimensions</h3>
        <FormField label="Are dimensions relevant to this commodity? (Manual Check)">
          <Select
            value={formData.dimensions.relevant === null ? '' : formData.dimensions.relevant ? 'yes' : 'no'}
            onChange={(e) => {
              const v = e.target.value;
              updateNested('dimensions', 'relevant', v === '' ? null : v === 'yes');
            }}
          >
            <option value="">— Select —</option>
            <option value="yes">Yes — size/dimensions should be declared</option>
            <option value="no">No — not relevant to this commodity</option>
          </Select>
        </FormField>

        {formData.dimensions.relevant && (
          <div className="mt-3">
            <FormField
              label="Dimensions"
              required
              confidence={confidence['dimensions.value']}
            >
              <Input
                value={formData.dimensions.value}
                onChange={(e) => updateNested('dimensions', 'value', e.target.value)}
                placeholder="e.g. 30cm x 20cm x 10cm"
              />
            </FormField>
          </div>
        )}
      </Card>

      {/* Section: Cosmetics Origin Symbol (conditional) */}
      {formData.category === 'cosmetics' && (
        <Card>
          <h3 className="text-base font-semibold text-navy-900 mb-4">Cosmetics Origin Symbol</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Product origin type (Manual Check)">
              <Select
                value={formData.cosmeticOrigin.isVegetarian === null ? '' : formData.cosmeticOrigin.isVegetarian ? 'veg' : 'nonveg'}
                onChange={(e) => {
                  const v = e.target.value;
                  updateNested('cosmeticOrigin', 'isVegetarian', v === '' ? null : v === 'veg');
                }}
              >
                <option value="">— Select —</option>
                <option value="veg">Vegetarian origin (green dot)</option>
                <option value="nonveg">Non-vegetarian origin (red/brown dot)</option>
              </Select>
            </FormField>

            <FormField label="Origin symbol declared on principal panel? (Manual Check)">
              <Select
                value={formData.cosmeticOrigin.symbolDeclared === null ? '' : formData.cosmeticOrigin.symbolDeclared ? 'yes' : 'no'}
                onChange={(e) => {
                  const v = e.target.value;
                  updateNested('cosmeticOrigin', 'symbolDeclared', v === '' ? null : v === 'yes');
                }}
              >
                <option value="">— Select —</option>
                <option value="yes">Yes — symbol is present</option>
                <option value="no">No — symbol is missing</option>
              </Select>
            </FormField>
          </div>
        </Card>
      )}

      {/* Section: Visibility Checks */}
      <Card>
        <h3 className="text-base font-semibold text-navy-900 mb-1">Inspector Visibility Checks</h3>
        <p className="text-xs text-gray-500 mb-4">
          Based on Rules 4, 7, 8, 9, 10. Confirmed manually by the inspecting officer.
        </p>
        <div className="space-y-3">
          {[
            {
              key: 'securelyAffixed' as const,
              label: 'Declaration is securely affixed to the package (not easily separable)',
            },
            {
              key: 'plainDefiniteConspicuousLegible' as const,
              label: 'Declaration is plain, definite, conspicuous, and legible',
            },
            {
              key: 'onPrincipalDisplayPanel' as const,
              label: 'Declaration is on the principal display panel or otherwise visibly placed',
            },
          ].map(({ key, label }) => (
            <FormField key={key} label={label}>
              <Select
                value={formData.visibility[key] === null ? '' : formData.visibility[key] ? 'yes' : 'no'}
                onChange={(e) => {
                  const v = e.target.value;
                  updateNested('visibility', key, v === '' ? null : v === 'yes');
                }}
              >
                <option value="">— Not confirmed —</option>
                <option value="yes">Yes — confirmed</option>
                <option value="no">No / Unclear</option>
              </Select>
            </FormField>
          ))}
        </div>
      </Card>

      {/* Section: Supplementary Fields */}
      <Card>
        <h3 className="text-base font-semibold text-navy-900 mb-1">Supplementary Information</h3>
        <p className="text-xs text-gray-500 mb-4">
          These fields capture useful data but are not universally mandatory under LMPC Rules unless a specific verified rule applies.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Batch / Lot Number"
            confidence={confidence['supplementary.batchLot']}
            source={sourceMap['supplementary.batchLot']}
            metadata={metadata['supplementary.batchLot']}
          >
            <Input
              value={formData.supplementary.batchLot}
              onChange={(e) => updateNested('supplementary', 'batchLot', e.target.value)}
              placeholder="e.g. B2025-0642"
            />
          </FormField>
          <FormField
            label="Barcode / GTIN / QR"
            confidence={confidence['supplementary.barcode']}
            source={sourceMap['supplementary.barcode']}
            metadata={metadata['supplementary.barcode']}
          >
            <Input
              value={formData.supplementary.barcode}
              onChange={(e) => updateNested('supplementary', 'barcode', e.target.value)}
              placeholder="e.g. 8901234567890"
            />
          </FormField>
          <FormField
            label="FSSAI Licence Number"
            hint="For food products"
            confidence={confidence['supplementary.fssaiLicence']}
            source={sourceMap['supplementary.fssaiLicence']}
            metadata={metadata['supplementary.fssaiLicence']}
          >
            <Input
              value={formData.supplementary.fssaiLicence}
              onChange={(e) => updateNested('supplementary', 'fssaiLicence', e.target.value)}
              placeholder="e.g. 10025048000123"
            />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Inspector Notes">
              <Textarea
                value={formData.supplementary.inspectorNotes}
                onChange={(e) => updateNested('supplementary', 'inspectorNotes', e.target.value)}
                rows={3}
                placeholder="Any additional observations..."
              />
            </FormField>
          </div>
        </div>
      </Card>

      {/* Development Mode: Extraction Diagnostics */}
      {extractionDiagnostics && (
        <Card className="border border-purple-200 bg-purple-50">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowDiagnostics(!showDiagnostics)}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">🛠️</span>
              <div>
                <h3 className="text-sm font-semibold text-purple-900">Extraction Diagnostics (Development)</h3>
                <p className="text-xs text-purple-700">Click to {showDiagnostics ? 'collapse' : 'expand'} detailed extraction logs</p>
              </div>
            </div>
            <span className="text-purple-600 font-bold">{showDiagnostics ? '−' : '+'}</span>
          </div>

          {showDiagnostics && (
            <div className="mt-4 pt-4 border-t border-purple-200 text-xs">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <span className="font-semibold text-purple-900">Text Length:</span> {extractionDiagnostics.textLength} chars
                </div>
                <div>
                  <span className="font-semibold text-purple-900">Total Words:</span> {extractionDiagnostics.wordCount}
                </div>
                <div>
                  <span className="font-semibold text-purple-900">Avg Confidence:</span> {extractionDiagnostics.avgConfidence}%
                </div>
                <div>
                  <span className="font-semibold text-purple-900">Fields Populated:</span> {extractionDiagnostics.fieldsExtracted?.length || 0}
                </div>
              </div>

              <div className="mb-4">
                <span className="font-semibold text-purple-900 block mb-1">Image Results:</span>
                <ul className="list-disc pl-5 space-y-1">
                  {extractionDiagnostics.imageResults?.map((res: any, idx: number) => (
                    <li key={idx}>
                      <span className="font-semibold capitalize">{res.label}</span>: {res.wordCount} words, {res.textLength} chars, {res.confidence}% conf
                    </li>
                  ))}
                </ul>
              </div>

              {extractionDiagnostics.fieldsExtracted?.length > 0 && (
                <div className="mb-4">
                  <span className="font-semibold text-emerald-800 block mb-1">Populated Fields:</span>
                  <div className="flex flex-wrap gap-1">
                    {extractionDiagnostics.fieldsExtracted.map((f: string) => (
                      <span key={f} className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded">
                        {f} ({confidence[f]}%)
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(metadata || {}).length > 0 && (
                <div className="mb-4">
                  <span className="font-semibold text-blue-800 block mb-2">Hybrid Merge Diagnostics:</span>
                  <div className="space-y-3">
                    {Object.entries(metadata).map(([field, meta]: [string, any]) => (
                      <div key={field} className="p-2 border border-blue-200 bg-white rounded">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-semibold text-blue-900">{field}</span>
                          <div className="flex items-center gap-1">
                            <span className="px-1 py-0.5 text-[10px] bg-gray-100 border border-gray-200 rounded">
                              Score: {meta.confidence ?? 'N/A'}
                            </span>
                            <span className={`px-1 py-0.5 text-[10px] rounded border ${
                              meta.source === 'ocr+ai' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                              meta.source === 'manual' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                              'bg-gray-100 text-gray-700 border-gray-300'
                            }`}>
                              Source: {meta.source}
                            </span>
                            <span className="px-1 py-0.5 text-[10px] bg-slate-100 text-slate-700 border-slate-300 rounded">
                              Panel: {meta.sourceSide}
                            </span>
                          </div>
                        </div>
                        <div className="text-[10px] grid grid-cols-2 gap-2 mt-2">
                          <div className="p-1.5 bg-gray-50 border border-gray-100 rounded">
                            <span className="block text-gray-400 mb-0.5">OCR Value / Evidence:</span>
                            <div className="break-words font-mono text-gray-700">{meta.ocrValue || '-'}</div>
                            {meta.ocrEvidenceSnippet && <div className="mt-1 pt-1 border-t border-gray-200 break-words text-gray-500 italic">&ldquo;{meta.ocrEvidenceSnippet}&rdquo;</div>}
                          </div>
                          <div className="p-1.5 bg-gray-50 border border-gray-100 rounded">
                            <span className="block text-gray-400 mb-0.5">Vision AI Value / Evidence:</span>
                            <div className="break-words font-mono text-gray-700">{meta.aiValue || '-'}</div>
                            {meta.aiEvidenceSnippet && <div className="mt-1 pt-1 border-t border-gray-200 break-words text-gray-500 italic">&ldquo;{meta.aiEvidenceSnippet}&rdquo;</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
