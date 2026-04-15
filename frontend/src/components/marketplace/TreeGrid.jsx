import TreeCard from "./TreeCard";

const TreeGrid = ({ trees }) => {
  if (!trees.length) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-center text-xs text-neutral-500">
        No trees match these filters yet. Adjust filters to explore the demo marketplace.
      </div>
    );
  }

  return (
    <section className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {trees.map((tree) => (
        <TreeCard key={tree.id} tree={tree} />
      ))}
    </section>
  );
};

export default TreeGrid;
