package retrieval

import (
	"hash/fnv"
	"math"
	"strings"
)

// Embedder turns text into an embedding vector. Implementations may be a local model, a remote
// service, or (for tests / deterministic fallback) a lexical hash embedder.
type Embedder interface {
	Embed(text string) ([]float32, error)
	Dim() int
}

// HashEmbedder is a deterministic, model-free lexical embedder: each token votes into a fixed number
// of dimensions via FNV hashing with sign. Cosine similarity rises with shared tokens, which is
// enough to exercise scoped retrieval and ranking without downloading weights. NOT a semantic model.
type HashEmbedder struct {
	Dimensions int
}

func NewHashEmbedder(dims int) *HashEmbedder {
	if dims <= 0 {
		dims = 128
	}
	return &HashEmbedder{Dimensions: dims}
}

func (h *HashEmbedder) Dim() int { return h.Dimensions }

func (h *HashEmbedder) Embed(text string) ([]float32, error) {
	v := make([]float32, h.Dimensions)
	for _, tok := range strings.Fields(strings.ToLower(text)) {
		if tok == "" {
			continue
		}
		// Two independent hashes -> dimension + sign, reduces collisions.
		d := fnv.New32a()
		_, _ = d.Write([]byte(tok))
		sum := d.Sum32()
		idx := int(sum % uint32(h.Dimensions))
		sign := float32(1)
		if sum&1 == 0 {
			sign = -1
		}
		v[idx] += sign
	}
	// L2 normalize.
	var norm float64
	for _, x := range v {
		norm += float64(x) * float64(x)
	}
	if norm > 0 {
		n := float32(math.Sqrt(norm))
		for i := range v {
			v[i] /= n
		}
	}
	return v, nil
}

// Cosine returns the cosine similarity of two vectors (0 if either is zero).
func Cosine(a, b []float32) float32 {
	n := len(a)
	if len(b) < n {
		n = len(b)
	}
	if n == 0 {
		return 0
	}
	var dot, na, nb float64
	for i := 0; i < n; i++ {
		dot += float64(a[i]) * float64(b[i])
		na += float64(a[i]) * float64(a[i])
		nb += float64(b[i]) * float64(b[i])
	}
	if na == 0 || nb == 0 {
		return 0
	}
	return float32(dot / (math.Sqrt(na) * math.Sqrt(nb)))
}
