import  { useRef , useEffect , useState} from 'react';
import {Product} from './PropertyCard.js'
import PropertyCard from './PropertyCard.js';
import "./styles.css";

// import {
//     Carousel,
//     CarouselContent,
//     CarouselItem,
//     CarouselNext,
//     CarouselPrevious,
//   } from "../../../src/ui/Carousel.js";
// import "./styles.css";

// interface CarouselProps {
//         items: Product[];
//       }

/// Hook para media query
// function useMediaQuery(query: string): boolean {
//     const [matches, setMatches] = useState(false);
//     useEffect(() => {
//       const mql = window.matchMedia(query);
//       const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
//       setMatches(mql.matches);
//       mql.addEventListener('change', listener);
//       return () => mql.removeEventListener('change', listener);
//     }, [query]);
//     return matches;
//   }
  
  interface CarouselProps {
    items: Product[];
  }
  
  const PropertyCarousel: React.FC<CarouselProps> = ({ items }) => {
    const [current, setCurrent] = useState(0);
    const wrapperRef = useRef<HTMLDivElement>(null);
  
    // Decide cuántos items por página
    const [itemsPerPage, setItemsPerPage] = useState(1);
    useEffect(() => {
      const onResize = () => {
        const w = window.innerWidth;
        if (w >= 1024) setItemsPerPage(3);
        else if (w >= 768) setItemsPerPage(2);
        else setItemsPerPage(1);
        setCurrent(0);
      };
      onResize();
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }, []);
  
    const pageCount = Math.ceil(items.length / itemsPerPage);
  
    const prev = () => setCurrent(c => Math.max(c - 1, 0));
    const next = () => setCurrent(c => Math.min(c + 1, pageCount - 1));
  
    return (
      <div className="relative w-full overflow-hidden" ref={wrapperRef}>
        {/* Track: display:flex, translateX en % */}
        <div
          className="flex transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {items.map(item => (
            <div
              key={item.id}
              className="flex-shrink-0 px-2"
              style={{ flex: `0 0 calc(100% / ${itemsPerPage})` }}
            >
              <PropertyCard {...item} />
            </div>
          ))}
        </div>
  
        {/* Flechas */}
        <button
          onClick={prev}
          disabled={current === 0}
          className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white p-2 rounded-full shadow disabled:opacity-50 z-10"
        >‹</button>
        <button
          onClick={next}
          disabled={current === pageCount - 1}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white p-2 rounded-full shadow disabled:opacity-50 z-10"
        >›</button>
  
        {/* Dots */}
        <div className="flex justify-center space-x-2 mt-4">
          {Array.from({ length: pageCount }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === current ? 'bg-gray-800' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>
    );
  };





// interface Props {
//   items: Product[]
// }

// const PropertyCarousel: React.FC<Props> = (props:Props) => {
//   return (
//     <div className="relative w-full flex flex-col gap-4 px-4 my-4">
//       {props.items.map((p) => (
//         <PropertyCard key={p.id} {...p} />
//       ))}
//     </div>
//   )

// }

export default PropertyCarousel
