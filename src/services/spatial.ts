import { UMAP } from "umap-js";
import { CachedEmbedding, MapData, PeakCluster, Point2D } from "../types";

export class SpatialComputer {
	computeMapData(
		cachedList: CachedEmbedding[],
		themeLevels: number = 24
	): MapData {
		if (cachedList.length < 3) {
			throw new Error("笔记数量不足（至少需要 3 篇有效笔记）以计算知识地貌。");
		}

		const vectors = cachedList.map((c) => c.vector);

		// 1. Adaptive UMAP 2D projection
		const nNeighbors = Math.min(15, Math.max(2, Math.floor(cachedList.length / 3)));
		const umap = new UMAP({
			nComponents: 2,
			nNeighbors: nNeighbors,
			minDist: 0.15,
			spread: 1.0,
		});

		const raw2d = umap.fit(vectors);

		// 2. Normalize 2D points to [0, 1] domain
		let minRawX = Infinity,
			maxRawX = -Infinity,
			minRawY = Infinity,
			maxRawY = -Infinity;

		for (const [x, y] of raw2d) {
			if (x < minRawX) minRawX = x;
			if (x > maxRawX) maxRawX = x;
			if (y < minRawY) minRawY = y;
			if (y > maxRawY) maxRawY = y;
		}

		const spanX = maxRawX - minRawX || 1;
		const spanY = maxRawY - minRawY || 1;

		const points2D: Point2D[] = raw2d.map(([x, y], idx) => {
			const nx = (x - minRawX) / spanX;
			const ny = (y - minRawY) / spanY;
			return {
				path: cachedList[idx].path,
				title: cachedList[idx].title,
				folder: cachedList[idx].folder || "/",
				x: nx,
				y: ny,
				clusterId: 0,
			};
		});

		// 3. 2D Gaussian Kernel Density Estimation on extended organic domain [-0.15, 1.15]
		const gridPad = 0.15;
		const gridMin = -gridPad;
		const gridMax = 1.0 + gridPad;
		const gridW = 160;
		const gridH = 160;

		const densityGrid: number[][] = Array.from({ length: gridH }, () =>
			new Array<number>(gridW).fill(0)
		);

		// Adaptive bandwidth estimate: fine enough to preserve cluster peaks, smooth enough for contours
		const bandwidth = Math.min(0.055, Math.max(0.04, 0.16 / Math.pow(points2D.length, 0.15)));
		const twoSigmaSq = 2 * bandwidth * bandwidth;
		const step = (gridMax - gridMin) / (gridW - 1);
		const radius = Math.ceil(bandwidth * 2.5 / step);

		for (const pt of points2D) {
			const gx = Math.round((pt.x - gridMin) / step);
			const gy = Math.round((pt.y - gridMin) / step);

			const minI = Math.max(0, gy - radius);
			const maxI = Math.min(gridH - 1, gy + radius);
			const minJ = Math.max(0, gx - radius);
			const maxJ = Math.min(gridW - 1, gx + radius);

			for (let i = minI; i <= maxI; i++) {
				const cy = gridMin + i * step;
				const dy = cy - pt.y;
				for (let j = minJ; j <= maxJ; j++) {
					const cx = gridMin + j * step;
					const dx = cx - pt.x;
					const distSq = dx * dx + dy * dy;
					densityGrid[i][j] += Math.exp(-distSq / twoSigmaSq);
				}
			}
		}

		// Normalize density grid to [0, 1]
		let maxD = 0;
		for (let i = 0; i < gridH; i++) {
			for (let j = 0; j < gridW; j++) {
				if (densityGrid[i][j] > maxD) maxD = densityGrid[i][j];
			}
		}
		if (maxD > 0) {
			for (let i = 0; i < gridH; i++) {
				for (let j = 0; j < gridW; j++) {
					densityGrid[i][j] = densityGrid[i][j] / maxD;
				}
			}
		}

		// 4. Peak detection (Local density maximums with threshold & dynamic merging)
		const candidatePeaks: { x: number; y: number; val: number }[] = [];
		const r = 3;
		for (let i = r; i < gridH - r; i++) {
			for (let j = r; j < gridW - r; j++) {
				const val = densityGrid[i][j];
				if (val < 0.12) continue;

				let isMax = true;
				for (let di = -r; di <= r && isMax; di++) {
					for (let dj = -r; dj <= r && isMax; dj++) {
						if (di === 0 && dj === 0) continue;
						const neighbor = densityGrid[i + di][j + dj];
						if (neighbor > val || (neighbor === val && (di < 0 || (di === 0 && dj < 0)))) {
							isMax = false;
						}
					}
				}
				if (isMax) {
					const px = gridMin + j * step;
					const py = gridMin + i * step;
					candidatePeaks.push({ x: px, y: py, val });
				}
			}
		}

		candidatePeaks.sort((a, b) => b.val - a.val);

		// Dynamic peak merging (merge_dist ~ 0.085)
		const mergeDist = points2D.length < 500 ? 0.09 : 0.085;
		const maxPeaks = points2D.length < 500 ? 6 : 8;
		const selectedPeaks: { x: number; y: number; val: number }[] = [];

		for (const p of candidatePeaks) {
			if (!selectedPeaks.some((sp) => Math.hypot(p.x - sp.x, p.y - sp.y) < mergeDist)) {
				selectedPeaks.push(p);
			}
			if (selectedPeaks.length >= maxPeaks) break;
		}

		if (selectedPeaks.length === 0) {
			selectedPeaks.push({ x: 0.5, y: 0.5, val: 1.0 });
		}

		// 5. Assign points to nearest peak
		const clusters: PeakCluster[] = selectedPeaks.map((p, idx) => ({
			id: idx,
			x: p.x,
			y: p.y,
			density: p.val,
			domain: `领域 ${idx + 1}`,
			badge: String(idx + 1),
			notes: [],
		}));

		for (const pt of points2D) {
			let closestDist = Infinity;
			let closestId = 0;
			for (let k = 0; k < clusters.length; k++) {
				const c = clusters[k];
				const d = Math.hypot(pt.x - c.x, pt.y - c.y);
				if (d < closestDist) {
					closestDist = d;
					closestId = k;
				}
			}
			pt.clusterId = closestId;
			clusters[closestId].notes.push(pt);
		}

		// Sort notes in each cluster by distance to centroid (medoids first)
		for (const c of clusters) {
			c.notes.sort((a, b) => {
				const distA = Math.hypot(a.x - c.x, a.y - c.y);
				const distB = Math.hypot(b.x - c.x, b.y - c.y);
				return distA - distB;
			});
		}

		return {
			points: points2D,
			clusters,
			densityGrid,
			gridWidth: gridW,
			gridHeight: gridH,
			gridBounds: [gridMin, gridMax],
			minX: gridMin,
			maxX: gridMax,
			minY: gridMin,
			maxY: gridMax,
			timestamp: Date.now(),
		};
	}
}
