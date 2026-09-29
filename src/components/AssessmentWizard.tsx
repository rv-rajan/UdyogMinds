import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin,
  Coins,
  Store,
  FileText,
  Check,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Mic,
  Info,
  CheckCircle2,
  ShoppingBag,
  Milk,
  Egg,
  Pill,
  Shirt,
  UtensilsCrossed,
  Cake,
  Smartphone,
  Wrench,
  Scissors,
  Sprout,
  Building2,
  ChevronDown,
  Search,
  X,
  Loader2,
} from 'lucide-react';

import {
  UserAssessmentState,
  Language,
  LocationData,
} from '../types';

import { TRANSLATIONS } from '../data/translations';
import {
  SAMPLE_LOCATIONS,
  BUSINESS_CATEGORIES,
} from '../data/mockData';

import {
  parseIndianCurrency,
  formatINR,
} from '../utils/calculations';

import {
  getCategoryTranslation,
} from '../data/categoryTranslations';

interface AssessmentWizardProps {
  assessmentState: UserAssessmentState;
  onChange: (newState: UserAssessmentState) => void;
  onSubmit: () => void;
  lang: Language;
}

/* ============================================================================
   LOCATION TYPES
============================================================================ */

interface LocationOption {
  id: string;
  name: string;
  code?: string;
  gramPanchayatName?: string;
}

/* ============================================================================
   LOCAL LOCATION APIs
============================================================================ */

// Use Vite's /api proxy so the browser does not hit localhost:3000 directly.
// vite.config.ts should proxy /api -> http://localhost:3000.
const API_BASE_URL = 'https://udyo-location-api.onrender.com/api';

const LOCATION_API = {
  districts: (state: string) =>
    `${API_BASE_URL}/states/${encodeURIComponent(state.toUpperCase())}/districts`,

  blocks: (state: string, district: string) =>
    `${API_BASE_URL}/states/${encodeURIComponent(state.toUpperCase())}/districts/${encodeURIComponent(district)}/blocks`,
};

const STATE_OPTIONS: LocationOption[] = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
  'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
].map((name) => ({ id: name, name }));

/* ============================================================================
   LOCATION API HELPERS
============================================================================ */

const getApiArray = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;

  const possibleKeys = [
    'data',
    'states',
    'districts',
    'blocks',
    'results',
    'items',
  ];

  for (const key of possibleKeys) {
    if (Array.isArray(payload?.[key])) {
      return payload[key];
    }
  }

  return [];
};

const normalizeLocationOptions = (payload: any): LocationOption[] => {
  const items = getApiArray(payload);
  const map = new Map<string, LocationOption>();

  items.forEach((item, index) => {
    if (typeof item === 'string' || typeof item === 'number') {
      const name = String(item).trim();
      if (name) {
        map.set(name.toLowerCase(), {
          id: name,
          name,
        });
      }
      return;
    }

    if (!item || typeof item !== 'object') return;

    const nameValue =
      item.name ??
      item.label ??
      item.title ??
      item.state_name ??
      item.district_name ??
      item.block_name ??
      item.tehsil_name ??
      item.state ??
      item.district ??
      item.block ??
      item.tehsil ??
      item.value;

    if (nameValue == null) return;

    const name = String(nameValue).trim();
    if (!name) return;

    const codeValue =
      item.id ??
      item.code ??
      item.value ??
      item.state_code ??
      item.district_code ??
      item.block_code;

    const id =
      codeValue != null
        ? String(codeValue)
        : `${name}-${index}`;

    const key = name.toLowerCase();

    if (!map.has(key)) {
      map.set(key, {
        id,
        name,
        code: codeValue != null ? String(codeValue) : undefined,
      });
    }
  });

  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'en', {
      sensitivity: 'base',
    })
  );
};

const fetchLocationOptions = async (url: string): Promise<LocationOption[]> => {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Location API returned ${response.status}`);
  }

  const data = await response.json();
  return normalizeLocationOptions(data);
};

/* ============================================================================
   SEARCHABLE DROPDOWN
============================================================================ */

interface SearchableDropdownProps {
  label: string;
  placeholder: string;
  value: string;
  options: LocationOption[];

  disabled?: boolean;
  loading?: boolean;

  onChange: (option: LocationOption | null) => void;

  noResultsText?: string;
  searchPlaceholder?: string;
  allowCustom?: boolean;
}

const SearchableDropdown: React.FC<
  SearchableDropdownProps
> = ({
  label,
  placeholder,
  value,
  options,
  disabled = false,
  loading = false,
  onChange,
  noResultsText = 'No results found',
  searchPlaceholder = 'Search...',
  allowCustom = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');

    const containerRef =
      useRef<HTMLDivElement>(null);

    const searchInputRef =
      useRef<HTMLInputElement>(null);

    const filteredOptions = useMemo(() => {
      const query = search.trim().toLowerCase();

      if (!query) {
        return options;
      }

      return options.filter((option) => {
        const nameMatch = option.name
          .toLowerCase()
          .includes(query);

        const gpMatch = option.gramPanchayatName
          ?.toLowerCase()
          .includes(query);

        return Boolean(nameMatch || gpMatch);
      });
    }, [options, search]);

    useEffect(() => {
      const handleOutsideClick = (
        event: MouseEvent
      ) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(
            event.target as Node
          )
        ) {
          setIsOpen(false);
        }
      };

      document.addEventListener(
        'mousedown',
        handleOutsideClick
      );

      return () => {
        document.removeEventListener(
          'mousedown',
          handleOutsideClick
        );
      };
    }, []);

    useEffect(() => {
      if (isOpen) {
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
      }
    }, [isOpen]);

    const selectedOption = options.find(
      (option) => option.name === value
    );

    const displayValue =
      selectedOption?.name || value;

    const handleSelect = (
      option: LocationOption
    ) => {
      onChange(option);
      setIsOpen(false);
      setSearch('');
    };

    const handleClear = (
      event: React.MouseEvent
    ) => {
      event.stopPropagation();

      onChange(null);
      setSearch('');
    };

    return (
      <div
        className="relative"
        ref={containerRef}
      >
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          {label}
        </label>

        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (!disabled) {
              setIsOpen((previous) => !previous);
            }
          }}
          className={`w-full px-3.5 py-2.5 rounded-xl form-input-clean text-sm text-left flex items-center justify-between gap-3 transition-all ${disabled
              ? 'bg-slate-50 text-slate-400 cursor-not-allowed'
              : 'bg-white text-slate-900 cursor-pointer'
            }`}
        >
          <span
            className={`truncate ${displayValue
                ? 'text-slate-900'
                : 'text-slate-400'
              }`}
          >
            {displayValue || placeholder}
          </span>

          <div className="flex items-center gap-1 shrink-0">
            {displayValue && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter' ||
                    event.key === ' '
                  ) {
                    event.preventDefault();
                    onChange(null);
                  }
                }}
                className="p-0.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                aria-label={`Clear ${label}`}
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}

            {loading ? (
              <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
            ) : (
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''
                  }`}
              />
            )}
          </div>
        </button>

        {isOpen && !disabled && (
          <div className="absolute z-50 left-0 right-0 mt-2 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            {/* Search */}
            <div className="p-2 border-b border-slate-100 bg-slate-50/80">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setIsOpen(false);
                    }
                  }}
                  placeholder={searchPlaceholder}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>

            {/* Results */}
            <div className="max-h-64 overflow-y-auto p-1.5">
              {loading ? (
                <div className="px-3 py-6 text-center text-xs text-slate-500">
                  <Loader2 className="w-5 h-5 mx-auto mb-2 text-emerald-600 animate-spin" />

                  Loading...
                </div>
              ) : filteredOptions.length > 0 ? (
                filteredOptions.map((option) => {
                  const isSelected =
                    option.name === value;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        handleSelect(option)
                      }
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between gap-2 ${isSelected
                          ? 'bg-emerald-50 text-emerald-800 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                        }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate">
                          {option.name}
                        </span>

                        {option.gramPanchayatName && (
                          <span className="block text-[10px] text-slate-400 truncate mt-0.5">
                            Gram Panchayat:{' '}
                            {
                              option.gramPanchayatName
                            }
                          </span>
                        )}
                      </span>

                      {isSelected && (
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-4 text-center">
                  <Search className="w-5 h-5 mx-auto mb-2 text-slate-300" />

                  {allowCustom && search.trim() ? (
                    <button
                      type="button"
                      onClick={() =>
                        handleSelect({
                          id: `custom-${search.trim()}`,
                          name: search.trim(),
                        })
                      }
                      className="w-full px-3 py-2.5 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-semibold hover:bg-emerald-100 transition-colors"
                    >
                      Use &quot;{search.trim()}&quot;
                    </button>
                  ) : (
                    <p className="text-xs text-slate-500">
                      {noResultsText}
                    </p>
                  )}
                </div>
              )}
            </div>

            {!loading &&
              filteredOptions.length > 0 && (
                <div className="px-3 py-2 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-400">
                  {filteredOptions.length} option
                  {filteredOptions.length !== 1
                    ? 's'
                    : ''}
                </div>
              )}
          </div>
        )}
      </div>
    );
  };

/* ============================================================================
   FALLBACK HELPERS
============================================================================ */

const createFallbackDistricts = (
  stateName: string
): LocationOption[] => {
  const map =
    new Map<string, LocationOption>();

  SAMPLE_LOCATIONS
    .filter(
      (location) =>
        location.state.toLowerCase() ===
        stateName.toLowerCase()
    )
    .forEach((location) => {
      const id =
        location.district.toLowerCase();

      if (!map.has(id)) {
        map.set(id, {
          id,
          name: location.district,
        });
      }
    });

  return Array.from(map.values());
};

const createFallbackBlocks = (
  stateName: string,
  districtName: string
): LocationOption[] => {
  const map =
    new Map<string, LocationOption>();

  SAMPLE_LOCATIONS
    .filter(
      (location) =>
        location.state.toLowerCase() ===
        stateName.toLowerCase() &&
        location.district.toLowerCase() ===
        districtName.toLowerCase()
    )
    .forEach((location) => {
      const block =
        location.block?.trim();

      if (!block) {
        return;
      }

      const id = block.toLowerCase();

      if (!map.has(id)) {
        map.set(id, {
          id,
          name: block,
        });
      }
    });

  return Array.from(map.values());
};

const createFallbackVillages = (
  stateName: string,
  districtName: string,
  blockName: string
): LocationOption[] => {
  const map =
    new Map<string, LocationOption>();

  SAMPLE_LOCATIONS
    .filter(
      (location) =>
        location.state.toLowerCase() ===
        stateName.toLowerCase() &&
        location.district.toLowerCase() ===
        districtName.toLowerCase() &&
        location.block?.toLowerCase() ===
        blockName.toLowerCase()
    )
    .forEach((location) => {
      const village =
        location.village?.trim();

      if (!village) {
        return;
      }

      const id =
        `${blockName}-${village}`.toLowerCase();

      if (!map.has(id)) {
        map.set(id, {
          id,
          name: village,
        });
      }
    });

  return Array.from(map.values());
};

/* ============================================================================
   MAIN COMPONENT
============================================================================ */

export const AssessmentWizard: React.FC<
  AssessmentWizardProps
> = ({
  assessmentState,
  onChange,
  onSubmit,
  lang,
}) => {
    const [currentStep, setCurrentStep] =
      useState<number>(1);

    const [
      isVoiceRecording,
      setIsVoiceRecording,
    ] = useState(false);

    /* ------------------------------------------------------------------------ */
    /* LOCATION API DATA                                                        */
    /* ------------------------------------------------------------------------ */

    // State list is local; only District and Block data are loaded from the API.
    const stateOptions = STATE_OPTIONS;

    const [districtOptions, setDistrictOptions] =
      useState<LocationOption[]>([]);

    const [blockOptions, setBlockOptions] =
      useState<LocationOption[]>([]);

    const [districtsLoading, setDistrictsLoading] =
      useState(false);

    const [blocksLoading, setBlocksLoading] =
      useState(false);

    const [locationError, setLocationError] =
      useState('');

    const locationLoading =
      districtsLoading || blocksLoading;

    /* ------------------------------------------------------------------------ */
    /* LOCATION VALUES                                                          */
    /* ------------------------------------------------------------------------ */

    const selectedState =
      assessmentState.location.state;

    const selectedDistrict =
      assessmentState.location.district;

    const selectedBlock =
      assessmentState.location.block;

    const selectedVillage =
      assessmentState.location.village;

    /* ------------------------------------------------------------------------ */
    /* TRANSLATIONS                                                             */
    /* ------------------------------------------------------------------------ */

    const t = TRANSLATIONS[lang];

    const isHindi = lang === 'hi';

    /* ------------------------------------------------------------------------ */
    /* CAPITAL PRESETS                                                          */
    /* ------------------------------------------------------------------------ */

    const capitalPresets = [
      {
        label: '₹10,000',
        value: 10000,
      },
      {
        label: '₹50,000',
        value: 50000,
      },
      {
        label: '₹1,00,000',
        value: 100000,
      },
      {
        label: '₹1,50,000',
        value: 150000,
      },
      {
        label: '₹2,00,000',
        value: 200000,
      },
      {
        label: '₹5,00,000',
        value: 500000,
      },
      {
        label: '₹10,00,000',
        value: 1000000,
      },
    ];

    /* ------------------------------------------------------------------------ */
    /* CATEGORY ICONS                                                           */
    /* ------------------------------------------------------------------------ */

    const categoryIcons: Record<
      string,
      React.ReactNode
    > = {
      grocery: (
        <ShoppingBag className="w-5 h-5" strokeWidth={1.8} />
      ),
      dairy: (
        <Milk className="w-5 h-5" strokeWidth={1.8} />
      ),
      poultry: (
        <Egg className="w-5 h-5" strokeWidth={1.8} />
      ),
      pharmacy: (
        <Pill className="w-5 h-5" strokeWidth={1.8} />
      ),
      clothing: (
        <Shirt className="w-5 h-5" strokeWidth={1.8} />
      ),
      food_stall: (
        <UtensilsCrossed className="w-5 h-5" strokeWidth={1.8} />
      ),
      bakery: (
        <Cake className="w-5 h-5" strokeWidth={1.8} />
      ),
      mobile_repair: (
        <Smartphone className="w-5 h-5" strokeWidth={1.8} />
      ),
      hardware: (
        <Wrench className="w-5 h-5" strokeWidth={1.8} />
      ),
      tailoring: (
        <Scissors className="w-5 h-5" strokeWidth={1.8} />
      ),
      salon: (
        <Sparkles className="w-5 h-5" strokeWidth={1.8} />
      ),
      agriculture_inputs: (
        <Sprout className="w-5 h-5" strokeWidth={1.8} />
      ),
      other: (
        <Building2 className="w-5 h-5" strokeWidth={1.8} />
      ),
    };

    /* ------------------------------------------------------------------------ */
    /* CATEGORY VISUALS - lightweight remote thumbnails + premium icon treatment */
    /* ------------------------------------------------------------------------ */

    const categoryImages: Record<string, string> = {
      grocery:
        'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=240&q=80',
      dairy:
        'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=240&q=80',
      poultry:
        'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&w=240&q=80',
      pharmacy:
        'https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&w=240&q=80',
      clothing:
        'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=240&q=80',
      food_stall:
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=240&q=80',
      bakery:
        'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=240&q=80',
      mobile_repair:
        'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=240&q=80',
      hardware:
        'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=240&q=80',
      tailoring:
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=240&q=80',
      salon:
        'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=240&q=80',
      agriculture_inputs:
        'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=240&q=80',
      other:
        'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=240&q=80',
    };

    /* ==========================================================================
       LOAD DISTRICTS AFTER STATE
    ========================================================================== */

    useEffect(() => {
      let cancelled = false;

      if (!selectedState) {
        setDistrictOptions([]);
        setBlockOptions([]);
        return;
      }

      const loadDistricts = async () => {
        setDistrictsLoading(true);
        setLocationError('');
        setDistrictOptions([]);
        setBlockOptions([]);

        // IMPORTANT:
        // District API is called only after a state has been selected.
        // The selected state name is inserted dynamically into the URL.
        const districtUrl = LOCATION_API.districts(selectedState);
        console.log('Loading districts for selected state:', selectedState);
        console.log('District API URL:', districtUrl);

        try {
          const options = await fetchLocationOptions(districtUrl);

          if (!cancelled) {
            setDistrictOptions(options);
          }
        } catch (error) {
          console.error('Districts API error:', error);

          if (!cancelled) {
            setDistrictOptions(
              createFallbackDistricts(selectedState)
            );
            setLocationError(
              isHindi
                ? 'जिला API से डेटा नहीं आया। Demo data उपलब्ध हो तो उसका उपयोग किया गया है।'
                : 'District API failed. Demo data is used when available.'
            );
          }
        } finally {
          if (!cancelled) {
            setDistrictsLoading(false);
          }
        }
      };

      loadDistricts();

      return () => {
        cancelled = true;
      };
    }, [selectedState, isHindi]);

    /* ==========================================================================
       LOAD BLOCKS AFTER DISTRICT
    ========================================================================== */

    useEffect(() => {
      let cancelled = false;

      if (!selectedState || !selectedDistrict) {
        setBlockOptions([]);
        return;
      }

      const loadBlocks = async () => {
        setBlocksLoading(true);
        setLocationError('');
        setBlockOptions([]);

        try {
          const options = await fetchLocationOptions(
            LOCATION_API.blocks(
              selectedState,
              selectedDistrict
            )
          );

          if (!cancelled) {
            setBlockOptions(options);
          }
        } catch (error) {
          console.error('Blocks API error:', error);

          if (!cancelled) {
            setBlockOptions(
              createFallbackBlocks(
                selectedState,
                selectedDistrict
              )
            );
            setLocationError(
              isHindi
                ? 'ब्लॉक/तहसील API से डेटा नहीं आया। Demo data उपलब्ध हो तो उसका उपयोग किया गया है।'
                : 'Block/Tehsil API failed. Demo data is used when available.'
            );
          }
        } finally {
          if (!cancelled) {
            setBlocksLoading(false);
          }
        }
      };

      loadBlocks();

      return () => {
        cancelled = true;
      };
    }, [selectedState, selectedDistrict, isHindi]);

    /* ==========================================================================
       VILLAGE / GRAM PANCHAYAT
  
       There is no village API yet, so the existing sample village data
       is used when available. Search also supports manual entry through
       the dropdown's custom-value option.
    ========================================================================== */

    const villageOptions = useMemo<LocationOption[]>(() => {
      if (!selectedBlock) {
        return [];
      }

      return createFallbackVillages(
        selectedState,
        selectedDistrict,
        selectedBlock
      );
    }, [
      selectedState,
      selectedDistrict,
      selectedBlock,
    ]);

    /* ==========================================================================
       LOCATION HANDLERS
    ========================================================================== */

    const handleStateChange = (
      option: LocationOption | null
    ) => {
      const stateName = option?.name || '';

      onChange({
        ...assessmentState,
        location: {
          ...assessmentState.location,
          state: stateName,
          district: '',
          block: '',
          village: '',
        },
      });

      // Clear dependent dropdowns immediately. The district useEffect
      // will fetch districts for the newly selected state.
      setDistrictOptions([]);
      setBlockOptions([]);
      setLocationError('');
    };

    const handleDistrictChange = (
      option: LocationOption | null
    ) => {
      const districtName = option?.name || '';

      onChange({
        ...assessmentState,
        location: {
          ...assessmentState.location,
          district: districtName,
          block: '',
          village: '',
        },
      });

      setLocationError('');
    };

    const handleBlockChange = (
      option: LocationOption | null
    ) => {
      const blockName = option?.name || '';

      onChange({
        ...assessmentState,
        location: {
          ...assessmentState.location,
          block: blockName,
          village: '',
        },
      });

      setLocationError('');
    };

    const handleVillageChange = (
      option: LocationOption | null
    ) => {
      const villageName = option?.name || '';

      onChange({
        ...assessmentState,
        location: {
          ...assessmentState.location,
          village: villageName,
        },
      });

      setLocationError('');
    };

      /* ==========================================================================
         CAPITAL HANDLERS
      ========================================================================== */

      const handleCapitalInputChange = (
        text: string
      ) => {
        const { amount } =
          parseIndianCurrency(text);

        onChange({
          ...assessmentState,
          capitalInput: text,
          capitalAmount: amount,
        });
      };

      const handleSelectPresetCapital = (
        amount: number
      ) => {
        onChange({
          ...assessmentState,
          capitalInput: formatINR(amount),
          capitalAmount: amount,
        });
      };

      /* ==========================================================================
         SAMPLE LOCATION
      ========================================================================== */

      const handleSelectLocationPreset = (
        loc: LocationData
      ) => {
        onChange({
          ...assessmentState,
          location: {
            ...loc,
          },
        });
      };

      /* ==========================================================================
         VOICE SIMULATION
      ========================================================================== */

      const handleVoiceSimulate = () => {
        setIsVoiceRecording(true);

        setTimeout(() => {
          setIsVoiceRecording(false);

          const selectedCategoryDescription =
            getLocalizedBusinessDescription(
              assessmentState.category || 'grocery'
            );

          const sampleNote = isHindi
            ? `${selectedCategoryDescription} मैं इसे गांव के स्थानीय ग्राहकों की जरूरत के अनुसार शुरू करना चाहता हूं।`
            : `${selectedCategoryDescription} I want to start it to serve local customers.`;

          onChange({
            ...assessmentState,
            businessDescription:
              sampleNote,
          });
        }, 1200);
      };

      /* ==========================================================================
         STEPS
      ========================================================================== */

      const steps = [
        {
          num: 1,
          title: t.stepLabel1,
          icon: MapPin,
        },
        {
          num: 2,
          title: t.stepLabel2,
          icon: Coins,
        },
        {
          num: 3,
          title: t.stepLabel3,
          icon: Store,
        },
        {
          num: 4,
          title: t.stepLabel4,
          icon: FileText,
        },
      ];

      /* ============================================================================
         LOCALIZED BUSINESS DESCRIPTIONS
      ========================================================================== */

      const localizedVoiceListening: Record<string, string> = {
        en: 'Listening...',
        hi: 'आवाज दर्ज की जा रही है...',
        bn: 'শোনা হচ্ছে...',
        mr: 'आवाज ऐकली जात आहे...',
        te: 'వింటున్నాము...',
        ta: 'கேட்கிறது...',
        gu: 'સાંભળવામાં આવી રહ્યું છે...',
        ur: 'سنا جا رہا ہے...',
        kn: 'ಕೇಳಲಾಗುತ್ತಿದೆ...',
        or: 'ଶୁଣାଯାଉଛି...',
        ml: 'കേൾക്കുന്നു...',
        pa: 'ਸੁਣਿਆ ਜਾ ਰਿਹਾ ਹੈ...',
        as: 'শুনি থকা হৈছে...',
        mai: 'सुनल जा रहल अछि...',
        sat: 'ᱟᱧᱛᱟ ᱥᱮ ᱥᱮᱫ ᱟ...',
        ks: 'آواز چھِ ریکارڈ کران...',
        ne: 'सुनिँदैछ...',
        kok: 'आवाज आयकात आसा...',
        sd: 'ٻڌو پيو وڃي...',
        doi: 'आवाज सुनी जा री ऐ...',
        mni: 'ꯑꯣꯏꯕ ꯂꯩꯕꯥ...',
        brx: 'सोनो जाबाय...',
        sa: 'श्रूयते...',
      };

      const localizedBusinessDescriptions: Record<
        string,
        { en: string; hi: string }
      > = {
        grocery: {
          en: 'Small grocery and daily FMCG essentials store serving local customers.',
          hi: 'स्थानीय ग्राहकों के लिए छोटी किराना और रोज़मर्रा की FMCG आवश्यकताओं की दुकान।',
        },
        dairy: {
          en: 'Dairy and milk chilling unit for local milk collection, cooling and supply.',
          hi: 'स्थानीय दूध संग्रह, शीतलीकरण और आपूर्ति के लिए डेयरी एवं मिल्क चिलिंग यूनिट।',
        },
        poultry: {
          en: 'Poultry and layer farm for broiler chicken, eggs and feed production.',
          hi: 'ब्रॉयलर चिकन, अंडे और पशु आहार उत्पादन के लिए पोल्ट्री एवं लेयर फार्म।',
        },
        pharmacy: {
          en: 'Local pharmacy and health clinic providing essential medicines and basic care.',
          hi: 'आवश्यक दवाइयों और प्राथमिक स्वास्थ्य सेवाओं के लिए स्थानीय फार्मेसी एवं हेल्थ क्लिनिक।',
        },
        clothing: {
          en: 'Garments and readymade clothing store serving everyday and seasonal needs.',
          hi: 'दैनिक और मौसमी जरूरतों के लिए कपड़ों और रेडीमेड परिधानों की दुकान।',
        },
        food_stall: {
          en: 'Local food stall or rural eatery serving breakfast, snacks and tea.',
          hi: 'नाश्ता, स्नैक्स और चाय उपलब्ध कराने वाला स्थानीय फूड स्टॉल या ग्रामीण भोजनालय।',
        },
        bakery: {
          en: 'Bakery and confectionery unit producing fresh bread, rusks, biscuits and snacks.',
          hi: 'ताज़ी ब्रेड, रस्क, बिस्कुट और स्नैक्स बनाने वाली बेकरी एवं कन्फेक्शनरी यूनिट।',
        },
        mobile_repair: {
          en: 'Mobile sales and repair shop for smartphones, recharge and basic electronics.',
          hi: 'स्मार्टफोन, रिचार्ज और बेसिक इलेक्ट्रॉनिक्स के लिए मोबाइल बिक्री एवं रिपेयर की दुकान।',
        },
        hardware: {
          en: 'Hardware and construction materials shop supplying tools and building essentials.',
          hi: 'औज़ारों और निर्माण सामग्री की जरूरतें पूरी करने वाली हार्डवेयर एवं कंस्ट्रक्शन सामग्री की दुकान।',
        },
        tailoring: {
          en: 'Tailoring and boutique centre for custom stitching, alterations and clothing services.',
          hi: 'कस्टम सिलाई, कपड़ों की फिटिंग और अन्य परिधान सेवाओं के लिए टेलरिंग एवं बुटीक सेंटर।',
        },
        salon: {
          en: 'Beauty parlour and grooming centre offering hair, facial and bridal services.',
          hi: 'हेयर, फेशियल और ब्राइडल सेवाओं के लिए ब्यूटी पार्लर एवं ग्रूमिंग सेंटर।',
        },
        agriculture_inputs: {
          en: 'Agri-inputs shop supplying certified seeds, bio-fertilizers and farm essentials.',
          hi: 'प्रमाणित बीज, जैव उर्वरक और खेती की आवश्यक सामग्री उपलब्ध कराने वाली कृषि-इनपुट दुकान।',
        },
        other: {
          en: 'A custom rural micro-enterprise based on local demand and available skills.',
          hi: 'स्थानीय मांग और उपलब्ध कौशल के आधार पर कस्टम ग्रामीण सूक्ष्म-उद्यम।',
        },
      };

      const getLocalizedBusinessDescription = (
        categoryId: string
      ): string => {
        const localized = localizedBusinessDescriptions[categoryId];

        // Keep the existing rich English/Hindi descriptions, but for every
        // other selected language use the already-localized category name +
        // tagline from categoryTranslations.ts. This prevents the textarea
        // from staying in English when the user switches language.
        if (localized) {
          if (lang === 'hi') return localized.hi;
          if (lang === 'en') return localized.en;
        }

        const category = BUSINESS_CATEGORIES.find(
          (item) => item.id === categoryId
        );

        if (!category) return '';

        const categoryText = getCategoryTranslation(
          lang,
          category.id
        );

        const translatedName = categoryText?.name?.trim();
        const translatedTagline = categoryText?.tagline?.trim();

        if (translatedName && translatedTagline) {
          return `${translatedName} — ${translatedTagline}`;
        }

        return category.defaultDescription || translatedName || '';
      };

      const isAutoGeneratedBusinessDescription = (
        value: string
      ): boolean => {
        const trimmed = value.trim();

        if (!trimmed) return true;

        return BUSINESS_CATEGORIES.some((category) => {
          const localized = localizedBusinessDescriptions[category.id];
          const categoryText = getCategoryTranslation(
            lang,
            category.id
          );
          const translatedDescription = categoryText?.name && categoryText?.tagline
            ? `${categoryText.name.trim()} — ${categoryText.tagline.trim()}`
            : '';

          return (
            trimmed === category.defaultDescription.trim() ||
            trimmed === localized?.en.trim() ||
            trimmed === localized?.hi.trim() ||
            (translatedDescription && trimmed === translatedDescription.trim())
          );
        });
      };

      /* ============================================================================
         SYNC AUTO-GENERATED DESCRIPTION WITH LANGUAGE
      ========================================================================== */

      useEffect(() => {
        if (!assessmentState.category) return;

        const currentDescription =
          assessmentState.businessDescription || '';

        if (!isAutoGeneratedBusinessDescription(currentDescription)) {
          return;
        }

        const localizedDescription =
          getLocalizedBusinessDescription(
            assessmentState.category
          );

        if (localizedDescription !== currentDescription) {
          onChange({
            ...assessmentState,
            businessDescription: localizedDescription,
          });
        }
      }, [lang, assessmentState.category]);



      /* ==========================================================================
         UI
      ========================================================================== */

      return (
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Top Wizard Card */}
          <div className="surface-card rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm relative">
            {/* Header & Step Indicator */}
            <div className="border-b border-slate-200/80 pb-6 mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                    {isHindi
                      ? 'चरणबद्ध मूल्यांकन'
                      : 'Interactive Assessment Form'}
                  </span>

                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
                    {t.assessmentTitle}
                  </h2>

                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    {t.assessmentSubtitle}
                  </p>
                </div>

                <div className="text-xs font-mono font-semibold text-emerald-800 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 self-start sm:self-auto">
                  {isHindi
                    ? `चरण ${currentStep} / 4`
                    : `Step ${currentStep} of 4`}
                </div>
              </div>

              {/* Stepper Tabs */}
              <div className="grid grid-cols-4 gap-2 mt-6">
                {steps.map((s) => {
                  const Icon = s.icon;

                  const isDone =
                    currentStep > s.num;

                  const isCurrent =
                    currentStep === s.num;

                  return (
                    <button
                      key={s.num}
                      onClick={() =>
                        setCurrentStep(s.num)
                      }
                      className={`flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 p-2 sm:p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${isCurrent
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs'
                          : isDone
                            ? 'bg-slate-50 text-slate-700 border-slate-200'
                            : 'bg-white text-slate-400 border-slate-200 hover:text-slate-600'
                        }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${isDone
                            ? 'bg-emerald-700 text-white'
                            : isCurrent
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                      >
                        {isDone ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          s.num
                        )}
                      </div>

                      <span className="hidden sm:inline">
                        {s.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step Forms */}
            <AnimatePresence mode="wait">
              {/* ================================================================== */}
              {/* STEP 1: LOCATION                                                  */}
              {/* ================================================================== */}

              {currentStep === 1 && (
                <motion.div
                  key="step-1"
                  initial={{
                    opacity: 0,
                    y: 8,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  exit={{
                    opacity: 0,
                    y: -8,
                  }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-700" />

                      <span>
                        {isHindi
                          ? 'व्यवसाय का प्रस्तावित स्थान'
                          : 'Proposed Business Location'}
                      </span>
                    </h3>

                    <p className="text-xs text-slate-500 mt-1">
                      {isHindi
                        ? 'अपने राज्य, जिले, ब्लॉक और गांव की जानकारी दर्ज करें या नीचे दिए गए डेमो सैंपल चुनें।'
                        : 'Specify State, District, Block, and Village or select a pre-loaded rural hub below.'}
                    </p>
                  </div>

                  <div className="flex items-start gap-2 text-[11px] text-slate-400">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />

                    <span>
                      {isHindi
                        ? 'पहले राज्य चुनें, फिर जिला, ब्लॉक और गांव/ग्राम पंचायत चुनें।'
                        : 'Select State first, followed by District, Block and Village / Gram Panchayat.'}
                    </span>
                  </div>
                  

                  {/* Location Input Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* STATE */}
                    <SearchableDropdown
                      label={t.stateLabel}
                      placeholder="Select State"
                      searchPlaceholder="Search State..."
                      value={selectedState}
                      options={stateOptions}
                      onChange={
                        handleStateChange
                      }
                      noResultsText="No state found"
                    />

                    {/* DISTRICT */}
                    <SearchableDropdown
                      label={t.districtLabel}
                      placeholder={
                        selectedState
                          ? 'Select District'
                          : 'Select State first'
                      }
                      searchPlaceholder="Search District..."
                      value={
                        selectedDistrict
                      }
                      options={
                        districtOptions
                      }
                      disabled={
                        !selectedState
                      }
                      loading={districtsLoading}
                      onChange={
                        handleDistrictChange
                      }
                      noResultsText={
                        'No district found'
                      }
                    />

                    {/* BLOCK */}
                    <SearchableDropdown
                      label={t.blockLabel}
                      placeholder={
                        selectedDistrict
                          ? 'Select Block'
                          : 'Select District first'
                      }
                      searchPlaceholder="Search Block..."
                      value={
                        selectedBlock
                      }
                      options={
                        blockOptions
                      }
                      disabled={
                        !selectedDistrict
                      }
                      loading={blocksLoading}
                      onChange={
                        handleBlockChange
                      }
                      noResultsText={
                        'No block found'
                      }
                    />

                    {/* VILLAGE / GRAM PANCHAYAT */}
                    <SearchableDropdown
                      label={t.villageLabel}
                      placeholder={
                        selectedBlock
                          ? 'Select Village / Gram Panchayat'
                          : 'Select Block first'
                      }
                      searchPlaceholder="Search Village / Gram Panchayat..."
                      value={
                        selectedVillage
                      }
                      options={villageOptions}
                      disabled={
                        !selectedBlock
                      }
                      loading={false}
                      onChange={
                        handleVillageChange
                      }
                      noResultsText={
                        'No village / Gram Panchayat found'
                      }
                      allowCustom
                    />
                  </div>

                  {/* API Error */}
                  {locationError && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                      <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />

                      <p className="text-xs text-amber-800">
                        {locationError}
                      </p>
                    </div>
                  )}

                  {/* API Loading */}
                  {locationLoading &&
                    selectedState && (
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />

                        <span>
                          {isHindi
                            ? 'सरकारी स्थान डेटा लोड हो रहा है...'
                            : 'Loading government location data...'}
                        </span>
                      </div>
                    )}

                  
                </motion.div>
              )}

              {/* ================================================================== */}
              {/* STEP 2: CAPITAL                                                   */}
              {/* ================================================================== */}

              {currentStep === 2 && (
                <motion.div
                  key="step-2"
                  initial={{
                    opacity: 0,
                    y: 8,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  exit={{
                    opacity: 0,
                    y: -8,
                  }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Coins className="w-4 h-4 text-amber-600" />

                      <span>
                        {t.capitalQuestion}
                      </span>
                    </h3>

                    <p className="text-xs text-slate-500 mt-1">
                      {t.capitalSub}
                    </p>
                  </div>

                  

                  {/* Preset Buttons */}
                  <div>
                    <div className="flex flex-wrap gap-2">
                      {capitalPresets.map(
                        (preset) => (
                          <button
                            key={
                              preset.value
                            }
                            type="button"
                            onClick={() =>
                              handleSelectPresetCapital(
                                preset.value
                              )
                            }
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${assessmentState.capitalAmount ===
                                preset.value
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-500 ring-1 ring-emerald-500 shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                              }`}
                          >
                            {preset.label}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Natural Language / Manual Input */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                    <label className="block text-xs font-semibold text-slate-700">
                      {t.manualCapitalLabel}
                    </label>

                    <div className="relative">
                      <input
                        type="text"
                        value={
                          assessmentState.capitalInput
                        }
                        onChange={(e) =>
                          handleCapitalInputChange(
                            e.target.value
                          )
                        }
                        placeholder={
                          t.capitalPlaceholder
                        }
                        className="w-full px-4 py-2.5 rounded-xl form-input-clean text-slate-900 text-sm font-medium pr-24"
                      />

                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        INR (₹)
                      </div>
                    </div>

                    {/* Normalized Capital Feedback Badge */}
                    <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />

                      <div className="text-xs text-slate-700">
                        <span>
                          {
                            t.understoodCapitalPrefix
                          }{' '}
                        </span>

                        <strong className="text-emerald-800 font-bold font-mono text-sm">
                          {formatINR(
                            assessmentState.capitalAmount
                          )}
                        </strong>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 italic">
                      {t.capitalNote}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* ================================================================== */}
              {/* STEP 3: BUSINESS CATEGORY                                          */}
              {/* ================================================================== */}

              {currentStep === 3 && (
                <motion.div
                  key="step-3"
                  initial={{
                    opacity: 0,
                    y: 8,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  exit={{
                    opacity: 0,
                    y: -8,
                  }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Store className="w-4 h-4 text-emerald-700" />

                      <span>
                        {t.categoryQuestion}
                      </span>
                    </h3>

                    <p className="text-xs text-slate-500 mt-1">
                      {t.categorySub}
                    </p>
                  </div>

                  

                  {/* Premium Business Category Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {BUSINESS_CATEGORIES.map((cat) => {
                      const isSelected =
                        assessmentState.category === cat.id;

                      const Icon =
                        categoryIcons[cat.id] || (
                          <Store className="w-5 h-5" />
                        );

                      const categoryImage =
                        categoryImages[cat.id];

                      const categoryText =
                        getCategoryTranslation(lang, cat.id);

                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() =>
                            onChange({
                              ...assessmentState,
                              category: cat.id,
                              businessDescription:
                                getLocalizedBusinessDescription(
                                  cat.id
                                ),
                            })
                          }
                          className={`group relative overflow-hidden text-left rounded-2xl border transition-all duration-200 cursor-pointer ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-500/80 shadow-[0_10px_28px_rgba(5,150,105,0.12)]'
                              : 'border-slate-200/90 bg-white hover:border-emerald-200 hover:shadow-[0_8px_24px_rgba(15,23,42,0.07)] hover:-translate-y-0.5'
                          }`}
                        >
                          {/* Topic image */}
                          <div className="relative h-24 overflow-hidden bg-slate-100">
                            {categoryImage ? (
                              <img
                                src={categoryImage}
                                alt=""
                                loading="lazy"
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                            ) : (
                              <div className="h-full w-full bg-gradient-to-br from-emerald-50 to-slate-100" />
                            )}

                            <div
                              className={`absolute inset-0 bg-gradient-to-t ${
                                isSelected
                                  ? 'from-emerald-950/55 via-emerald-950/5 to-transparent'
                                  : 'from-slate-950/45 via-slate-950/5 to-transparent'
                              }`}
                            />

                            {/* Premium icon badge */}
                            <div
                              className={`absolute left-3 bottom-3 w-10 h-10 rounded-xl flex items-center justify-center border backdrop-blur-md shadow-lg transition-all ${
                                isSelected
                                  ? 'bg-emerald-700 text-white border-white/30'
                                  : 'bg-white/90 text-slate-700 border-white/70 group-hover:bg-white'
                              }`}
                            >
{Icon}
                            </div>

                            {isSelected && (
                              <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold text-emerald-800 shadow-sm backdrop-blur">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Selected
                              </span>
                            )}
                          </div>

                          {/* Card content */}
                          <div className="p-3.5">
                            <div className="flex items-start justify-between gap-2">
                              <h4
                                className={`text-sm font-bold leading-5 line-clamp-1 ${
                                  isSelected
                                    ? 'text-emerald-950'
                                    : 'text-slate-900'
                                }`}
                              >
                                {categoryText.name}
                              </h4>

                              <span
                                className={`shrink-0 mt-0.5 transition-all ${
                                  isSelected
                                    ? 'text-emerald-700'
                                    : 'text-slate-300 group-hover:text-emerald-500'
                                }`}
                              >
                                <ArrowRight className="w-4 h-4" />
                              </span>
                            </div>

                            <p className="text-[11px] leading-4 text-slate-500 mt-1 line-clamp-2 min-h-[32px]">
                              {categoryText.tagline}
                            </p>

                            <div className="mt-3 flex items-center gap-1.5">
                              <span
                                className={`h-1 w-8 rounded-full ${
                                  isSelected
                                    ? 'bg-emerald-600'
                                    : 'bg-slate-200 group-hover:bg-emerald-300'
                                }`}
                              />
                              <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                Rural enterprise
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* ================================================================== */}
              {/* STEP 4: BUSINESS DESCRIPTION                                      */}
              {/* ================================================================== */}

              {currentStep === 4 && (
                <motion.div
                  key="step-4"
                  initial={{
                    opacity: 0,
                    y: 8,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  exit={{
                    opacity: 0,
                    y: -8,
                  }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-600" />

                      <span>
                        {t.descriptionQuestion}
                      </span>
                    </h3>

                    <p className="text-xs text-slate-500 mt-1">
                      {t.descriptionSub}
                    </p>
                  </div>

                  {/* Text Area & Voice Simulation */}
                  <div className="space-y-3">
                    <div className="relative">
                      <textarea
                        rows={4}
                        value={
                          assessmentState.businessDescription
                        }
                        onChange={(e) =>
                          onChange({
                            ...assessmentState,
                            businessDescription:
                              e.target.value,
                          })
                        }
                        placeholder={
                          t.descriptionPlaceholder
                        }
                        className="w-full min-h-[132px] p-3.5 rounded-xl form-input-clean text-slate-900 text-sm leading-relaxed"
                        aria-label={t.descriptionQuestion}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={
                          handleVoiceSimulate
                        }
                        disabled={
                          isVoiceRecording
                        }
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-xs text-slate-700 transition-colors cursor-pointer"
                      >
                        <Mic
                          className={`w-3.5 h-3.5 ${isVoiceRecording
                              ? 'text-red-500 animate-pulse'
                              : 'text-emerald-700'
                            }`}
                        />

                        <span>
                          {isVoiceRecording
                            ? (localizedVoiceListening[String(lang)] || localizedVoiceListening.en)
                            : t.voiceInputSim}
                        </span>
                      </button>

                      <div className="text-[11px] text-slate-400">
                        {isHindi
                          ? 'वैकल्पिक - आप सीधे सबमिट भी कर सकते हैं'
                          : 'Optional details for localized advisory context'}
                      </div>
                    </div>
                  </div>

                  {/* Assessment Summary Preview */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {isHindi
                        ? 'मूल्यांकन सारांश'
                        : 'Assessment Summary'}
                    </span>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs">
                      <div>
                        <span className="text-slate-500 block">
                          {t.villageLabel}:
                        </span>

                        <strong className="text-slate-800">
                          {
                            assessmentState.location
                              .village
                          }
                          ,{' '}
                          {
                            assessmentState.location
                              .district
                          }
                        </strong>
                      </div>

                      <div>
                        <span className="text-slate-500 block">
                          {t.stepLabel2}:
                        </span>

                        <strong className="text-emerald-800 font-mono text-sm">
                          {formatINR(
                            assessmentState.capitalAmount
                          )}
                        </strong>
                      </div>

                      <div>
                        <span className="text-slate-500 block">
                          {t.stepLabel3}:
                        </span>

                        <strong className="text-slate-800">
                          {
                            getCategoryTranslation(
                              lang,
                              assessmentState.category
                            ).name
                          }
                        </strong>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Wizard Footer Navigation */}
            <div className="border-t border-slate-200/80 pt-6 mt-8 flex items-center justify-between gap-4">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setCurrentStep(
                      currentStep - 1
                    )
                  }
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold border border-slate-300 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />

                  <span>{t.btnBack}</span>
                </button>
              ) : (
                <div />
              )}

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={() =>
                    setCurrentStep(
                      currentStep + 1
                    )
                  }
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <span>{t.btnNext}</span>

                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  id="submit-assessment-btn"
                  onClick={onSubmit}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-emerald-200" />

                  <span>
                    {t.btnSubmitAssessment}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      );
    };
