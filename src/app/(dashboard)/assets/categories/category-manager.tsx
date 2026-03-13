"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { createAssetCategory } from "@/lib/queries/assets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";

interface Category {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface Props {
  categories: Category[];
  companyId: string;
}

export function AssetCategoryManager({ categories: initial, companyId }: Props) {
  const [categories, setCategories] = useState(initial);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const result = await createAssetCategory({ company_id: companyId, name, description });
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Category created");
    setCategories((prev) => [...prev, { id: crypto.randomUUID(), name, description: description || null, is_active: true }]);
    setName(""); setDescription("");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Add Category</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input placeholder="e.g. Vehicles, Computers, Furniture"
                value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Add Category
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Existing Categories ({categories.length})</CardTitle></CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No categories yet. Add the first one.</p>
          ) : (
            <ul className="divide-y">
              {categories.map((cat) => (
                <li key={cat.id} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{cat.name}</p>
                    {cat.description && <p className="text-xs text-muted-foreground">{cat.description}</p>}
                  </div>
                  <StatusBadge status={cat.is_active ? "active" : "inactive"} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
