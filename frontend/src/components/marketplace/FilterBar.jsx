const FilterBar = ({ filters, onChange }) => {
  const handleChange = (event) => {
    const { name, value } = event.target;
    onChange({ ...filters, [name]: value });
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-xs text-neutral-700 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-1 flex-wrap gap-3">
        <div className="flex min-w-30 flex-1 flex-col gap-1">
          <label className="text-[11px] font-medium text-neutral-600">Species</label>
          <input
            name="species"
            value={filters.species}
            onChange={handleChange}
            placeholder="Any species"
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-900 outline-none focus:border-neutral-900"
          />
        </div>
        <div className="flex min-w-30 flex-1 flex-col gap-1">
          <label className="text-[11px] font-medium text-neutral-600">Min Price</label>
          <input
            name="minPrice"
            type="number"
            value={filters.minPrice}
            onChange={handleChange}
            placeholder="0"
            min="0"
            step="0.01"
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-900 outline-none focus:border-neutral-900"
          />
        </div>
        <div className="flex min-w-30 flex-1 flex-col gap-1">
          <label className="text-[11px] font-medium text-neutral-600">Max Price</label>
          <input
            name="maxPrice"
            type="number"
            value={filters.maxPrice}
            onChange={handleChange}
            placeholder="Any"
            min="0"
            step="0.01"
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-900 outline-none focus:border-neutral-900"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-neutral-600">Sort By</label>
          <select
            name="sortBy"
            value={filters.sortBy}
            onChange={handleChange}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-900 outline-none focus:border-neutral-900"
          >
            <option value="price">Price</option>
            <option value="created_at">Listed Date</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-neutral-600">Order</label>
          <select
            name="sortOrder"
            value={filters.sortOrder}
            onChange={handleChange}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-900 outline-none focus:border-neutral-900"
          >
            <option value="asc">Low to High</option>
            <option value="desc">High to Low</option>
          </select>
        </div>
      </div>
    </section>
  );
};

export default FilterBar;
