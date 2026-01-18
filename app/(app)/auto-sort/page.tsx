"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { SignedIn } from "@clerk/nextjs";
import * as Lucide from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { formatMoney } from "@/components/utils";

type Tab = "category" | "merchant" | "suggestions";

export default function RulesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("category");
  
  // Category Rules
  const categoryRules = useQuery(api.rules.listCategoryRules, {});
  const createCategoryRule = useMutation(api.rules.createCategoryRule);
  const updateCategoryRule = useMutation(api.rules.updateCategoryRule);
  const deleteCategoryRule = useMutation(api.rules.deleteCategoryRule);
  
  // Merchant Rules
  const merchantRules = useQuery(api.rules.listMerchantRules, {});
  const createMerchantRule = useMutation(api.rules.createMerchantRule);
  
  // Plaid-suggested rules
  const plaidSuggestions = useQuery(api.plaid.getPlaidMerchantRuleSuggestions, {});

  // Create Category Rule Modal
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [catRuleName, setCatRuleName] = useState("");
  const [catMatchMerchant, setCatMatchMerchant] = useState("");
  const [catMatchNote, setCatMatchNote] = useState("");
  const [catAssignCategory, setCatAssignCategory] = useState("");
  const [catAssignTags, setCatAssignTags] = useState("");
  const [catPriority, setCatPriority] = useState("0");
  const [creating, setCreating] = useState(false);

  // Create Merchant Rule Modal
  const [showCreateMerchant, setShowCreateMerchant] = useState(false);
  const [merchPattern, setMerchPattern] = useState("");
  const [merchMatchType, setMerchMatchType] = useState<"exact" | "contains" | "regex">("contains");
  const [merchNormalized, setMerchNormalized] = useState("");
  const [merchCategory, setMerchCategory] = useState("");
  
  // Count of suggestions for badge
  const suggestionCount = useMemo(() => plaidSuggestions?.length || 0, [plaidSuggestions]);

  const resetCategoryModal = () => {
    setShowCreateCategory(false);
    setCatRuleName("");
    setCatMatchMerchant("");
    setCatMatchNote("");
    setCatAssignCategory("");
    setCatAssignTags("");
    setCatPriority("0");
  };

  const resetMerchantModal = () => {
    setShowCreateMerchant(false);
    setMerchPattern("");
    setMerchMatchType("contains");
    setMerchNormalized("");
    setMerchCategory("");
  };

  const handleCreateCategoryRule = async () => {
    if (!catMatchMerchant && !catMatchNote) return;
    if (!catAssignCategory) return;
    
    setCreating(true);
    try {
      await createCategoryRule({
        name: catRuleName || undefined,
        matchMerchantContains: catMatchMerchant || undefined,
        matchNoteContains: catMatchNote || undefined,
        assignCategory: catAssignCategory,
        assignTags: catAssignTags ? catAssignTags.split(",").map((t) => t.trim()) : undefined,
        priority: parseInt(catPriority) || 0,
      });
      resetCategoryModal();
    } catch (e) {
      console.error("Failed to create category rule:", e);
    } finally {
      setCreating(false);
    }
  };

  const handleCreateMerchantRule = async () => {
    if (!merchPattern || !merchNormalized) return;
    
    setCreating(true);
    try {
      await createMerchantRule({
        matchPattern: merchPattern,
        matchType: merchMatchType,
        normalizedName: merchNormalized,
        defaultCategory: merchCategory || undefined,
      });
      resetMerchantModal();
    } catch (e) {
      console.error("Failed to create merchant rule:", e);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleCategoryRule = async (id: Id<"categoryRules">, enabled: boolean) => {
    await updateCategoryRule({ id, enabled: !enabled });
  };

  const handleDeleteCategoryRule = async (id: Id<"categoryRules">) => {
    if (confirm("Delete this rule?")) {
      await deleteCategoryRule({ id });
    }
  };
  
  const handleCreateFromSuggestion = async (suggestion: { merchantName: string; suggestedCategory: string }) => {
    setCreating(true);
    try {
      await createCategoryRule({
        name: `${suggestion.merchantName} → ${suggestion.suggestedCategory}`,
        matchMerchantContains: suggestion.merchantName,
        assignCategory: suggestion.suggestedCategory,
        priority: 0,
      });
      // Switch to category rules tab to show the new rule
      setActiveTab("category");
    } catch (e) {
      console.error("Failed to create rule:", e);
    } finally {
      setCreating(false);
    }
  };

  const tabs: { key: Tab; label: string; icon: typeof Lucide.Tag; badge?: number }[] = [
    { key: "category", label: "Category", icon: Lucide.Tag },
    { key: "merchant", label: "Merchant", icon: Lucide.Store },
    { key: "suggestions", label: "Suggested", icon: Lucide.Sparkles, badge: suggestionCount },
  ];

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: "var(--background)" }}>
      <SignedIn>
        <PageHeader title="Auto-Sort" subtitle="Automatically categorize and organize transactions" />

        {/* Tab Switcher */}
        <div className="px-4 mb-4">
          <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: "var(--surface-2)" }}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors relative"
                  style={{
                    backgroundColor: isActive ? "var(--surface)" : "transparent",
                    color: isActive ? "var(--primary)" : "var(--text-secondary)",
                  }}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span 
                      className="ml-1 px-1.5 py-0.5 text-xs rounded-full"
                      style={{ 
                        backgroundColor: isActive ? "var(--primary)" : "var(--primary-subtle)", 
                        color: isActive ? "var(--on-primary)" : "var(--primary)" 
                      }}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 space-y-4">
          {activeTab === "category" && (
            <>
              {/* Category Rules List */}
              {categoryRules === undefined ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: "var(--surface-2)" }} />
                  ))}
                </div>
              ) : categoryRules.length === 0 ? (
                <div className="text-center py-12">
                  <Lucide.Wand2 className="h-12 w-12 mx-auto mb-3" style={{ color: "var(--text-tertiary)" }} />
                  <div className="font-medium mb-1" style={{ color: "var(--text)" }}>No category rules yet</div>
                  <div className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                    Create rules to auto-categorize transactions
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {categoryRules.map((rule: Doc<"categoryRules">) => (
                    <div key={rule._id} className="p-4 rounded-xl" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium" style={{ color: rule.enabled !== false ? "var(--text)" : "var(--text-tertiary)" }}>
                              {rule.name || "Unnamed Rule"}
                            </span>
                            {rule.enabled === false && (
                              <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "var(--surface-2)", color: "var(--text-secondary)" }}>Disabled</span>
                            )}
                          </div>
                          <div className="text-xs space-y-1" style={{ color: "var(--text-secondary)" }}>
                            {rule.matchMerchantContains && <div>If merchant contains &quot;{rule.matchMerchantContains}&quot;</div>}
                            {rule.matchMerchantExact && <div>If merchant is &quot;{rule.matchMerchantExact}&quot;</div>}
                            {rule.matchNoteContains && <div>If note contains &quot;{rule.matchNoteContains}&quot;</div>}
                            {(rule.matchAmountMinCents || rule.matchAmountMaxCents) && (
                              <div>
                                Amount: {rule.matchAmountMinCents ? `≥${formatMoney(rule.matchAmountMinCents)}` : ""} 
                                {rule.matchAmountMinCents && rule.matchAmountMaxCents && " and "}
                                {rule.matchAmountMaxCents ? `≤${formatMoney(rule.matchAmountMaxCents)}` : ""}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {rule.assignCategory && (
                              <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: "var(--primary-subtle)", color: "var(--primary)" }}>
                                → {rule.assignCategory}
                              </span>
                            )}
                            {rule.assignTags?.map((tag) => (
                              <span key={tag} className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: "var(--surface-2)", color: "var(--text-secondary)" }}>
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleCategoryRule(rule._id, rule.enabled !== false)}
                            className="p-2 rounded-lg hover:opacity-80"
                            style={{ color: rule.enabled !== false ? "var(--success)" : "var(--text-tertiary)" }}
                          >
                            {rule.enabled !== false ? <Lucide.ToggleRight className="h-5 w-5" /> : <Lucide.ToggleLeft className="h-5 w-5" />}
                          </button>
                          <button
                            onClick={() => handleDeleteCategoryRule(rule._id)}
                            className="p-2 rounded-lg hover:opacity-80"
                            style={{ color: "var(--danger)" }}
                          >
                            <Lucide.Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {rule.timesApplied !== undefined && rule.timesApplied > 0 && (
                        <div className="mt-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
                          Applied {rule.timesApplied} time{rule.timesApplied !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* FAB for Category Rules */}
              <button
                onClick={() => setShowCreateCategory(true)}
                className="fixed bottom-24 right-4 w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-40"
                style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
              >
                <Lucide.Plus className="h-6 w-6" />
              </button>
            </>
          )}

          {activeTab === "merchant" && (
            <>
              {/* Merchant Rules List */}
              {merchantRules === undefined ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: "var(--surface-2)" }} />
                  ))}
                </div>
              ) : merchantRules.length === 0 ? (
                <div className="text-center py-12">
                  <Lucide.Store className="h-12 w-12 mx-auto mb-3" style={{ color: "var(--text-tertiary)" }} />
                  <div className="font-medium mb-1" style={{ color: "var(--text)" }}>No merchant rules yet</div>
                  <div className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                    Normalize messy merchant names
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {merchantRules.map((rule: Doc<"merchantRules">) => (
                    <div key={rule._id} className="p-4 rounded-xl" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm px-2 py-0.5 rounded" style={{ backgroundColor: "var(--surface-2)", color: "var(--text-secondary)" }}>
                              {rule.matchType}
                            </span>
                            <span className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>
                              &quot;{rule.matchPattern}&quot;
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Lucide.ArrowRight className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                            <span className="font-medium" style={{ color: "var(--text)" }}>{rule.normalizedName}</span>
                            {rule.defaultCategory && (
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--primary-subtle)", color: "var(--primary)" }}>
                                {rule.defaultCategory}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {rule.timesApplied !== undefined && rule.timesApplied > 0 && (
                        <div className="mt-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
                          Applied {rule.timesApplied} time{rule.timesApplied !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* FAB for Merchant Rules */}
              <button
                onClick={() => setShowCreateMerchant(true)}
                className="fixed bottom-24 right-4 w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-40"
                style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}
              >
                <Lucide.Plus className="h-6 w-6" />
              </button>
            </>
          )}
          
          {activeTab === "suggestions" && (
            <>
              {/* Plaid-Suggested Rules */}
              {plaidSuggestions === undefined ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: "var(--surface-2)" }} />
                  ))}
                </div>
              ) : plaidSuggestions.length === 0 ? (
                <div className="text-center py-12">
                  <Lucide.Sparkles className="h-12 w-12 mx-auto mb-3" style={{ color: "var(--text-tertiary)" }} />
                  <div className="font-medium mb-1" style={{ color: "var(--text)" }}>No suggestions available</div>
                  <div className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                    Import more transactions from Plaid to get smart categorization suggestions
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl" style={{ backgroundColor: "var(--primary-subtle)" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Lucide.Sparkles className="h-4 w-4" style={{ color: "var(--primary)" }} />
                      <span className="text-sm font-medium" style={{ color: "var(--primary)" }}>Smart Suggestions from Plaid</span>
                    </div>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Based on your transaction patterns. Tap a suggestion to create an auto-sort rule.
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    {plaidSuggestions.map((suggestion, idx) => (
                      <button
                        key={`${suggestion.merchantName}-${idx}`}
                        onClick={() => handleCreateFromSuggestion(suggestion)}
                        disabled={creating}
                        className="w-full p-4 rounded-xl text-left transition-colors hover:opacity-90 disabled:opacity-50"
                        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Lucide.Store className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} />
                              <span className="font-medium capitalize" style={{ color: "var(--text)" }}>
                                {suggestion.merchantName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Lucide.ArrowRight className="h-3 w-3" style={{ color: "var(--text-tertiary)" }} />
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--primary-subtle)", color: "var(--primary)" }}>
                                {suggestion.suggestedCategory}
                              </span>
                            </div>
                            <div className="mt-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
                              {suggestion.transactionCount} transactions · {formatMoney(suggestion.totalAmountCents)} total
                            </div>
                          </div>
                          <Lucide.Plus className="h-5 w-5 shrink-0" style={{ color: "var(--primary)" }} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Create Category Rule Modal */}
        {showCreateCategory && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={resetCategoryModal} />
            <div className="relative w-full sm:max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5" style={{ backgroundColor: "var(--surface)" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>New Category Rule</h2>
                <button onClick={resetCategoryModal}><Lucide.X className="h-5 w-5" style={{ color: "var(--text-secondary)" }} /></button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Rule Name (optional)</label>
                  <input type="text" value={catRuleName} onChange={(e) => setCatRuleName(e.target.value)} placeholder="e.g., Coffee shops" className="w-full px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }} />
                </div>

                <div className="p-3 rounded-lg" style={{ backgroundColor: "var(--surface-2)" }}>
                  <div className="text-xs font-medium mb-3" style={{ color: "var(--text-secondary)" }}>When...</div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>Merchant contains</label>
                      <input type="text" value={catMatchMerchant} onChange={(e) => setCatMatchMerchant(e.target.value)} placeholder="starbucks" className="w-full px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }} />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>Note contains</label>
                      <input type="text" value={catMatchNote} onChange={(e) => setCatMatchNote(e.target.value)} placeholder="work lunch" className="w-full px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }} />
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg" style={{ backgroundColor: "var(--surface-2)" }}>
                  <div className="text-xs font-medium mb-3" style={{ color: "var(--text-secondary)" }}>Then assign...</div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>Category</label>
                      <input type="text" value={catAssignCategory} onChange={(e) => setCatAssignCategory(e.target.value)} placeholder="Food & Drink" className="w-full px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }} />
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>Tags (comma-separated)</label>
                      <input type="text" value={catAssignTags} onChange={(e) => setCatAssignTags(e.target.value)} placeholder="coffee, morning" className="w-full px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }} />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Priority</label>
                  <input type="number" value={catPriority} onChange={(e) => setCatPriority(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }} />
                  <div className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>Higher = checked first</div>
                </div>

                <button onClick={handleCreateCategoryRule} disabled={(!catMatchMerchant && !catMatchNote) || !catAssignCategory || creating} className="w-full py-3 rounded-xl font-medium disabled:opacity-50" style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}>
                  {creating ? "Creating..." : "Create Rule"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Merchant Rule Modal */}
        {showCreateMerchant && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={resetMerchantModal} />
            <div className="relative w-full sm:max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5" style={{ backgroundColor: "var(--surface)" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>New Merchant Rule</h2>
                <button onClick={resetMerchantModal}><Lucide.X className="h-5 w-5" style={{ color: "var(--text-secondary)" }} /></button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Match Pattern</label>
                  <input type="text" value={merchPattern} onChange={(e) => setMerchPattern(e.target.value)} placeholder="AMZN*MKTP" className="w-full px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }} />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Match Type</label>
                  <div className="flex gap-2">
                    {(["contains", "exact", "regex"] as const).map((type) => (
                      <button key={type} onClick={() => setMerchMatchType(type)} className="flex-1 py-2 rounded-lg text-sm font-medium capitalize" style={{ backgroundColor: merchMatchType === type ? "var(--primary)" : "var(--surface-2)", color: merchMatchType === type ? "var(--on-primary)" : "var(--text-secondary)", border: "1px solid var(--border)" }}>
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Normalized Name</label>
                  <input type="text" value={merchNormalized} onChange={(e) => setMerchNormalized(e.target.value)} placeholder="Amazon" className="w-full px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }} />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Default Category (optional)</label>
                  <input type="text" value={merchCategory} onChange={(e) => setMerchCategory(e.target.value)} placeholder="Shopping" className="w-full px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)" }} />
                </div>

                <button onClick={handleCreateMerchantRule} disabled={!merchPattern || !merchNormalized || creating} className="w-full py-3 rounded-xl font-medium disabled:opacity-50" style={{ backgroundColor: "var(--primary)", color: "var(--on-primary)" }}>
                  {creating ? "Creating..." : "Create Rule"}
                </button>
              </div>
            </div>
          </div>
        )}
      </SignedIn>
    </div>
  );
}
