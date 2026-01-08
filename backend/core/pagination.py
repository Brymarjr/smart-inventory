from rest_framework.pagination import PageNumberPagination

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 10                  # Default size
    page_size_query_param = 'page_size' # Allow client to override (e.g. ?page_size=5)
    max_page_size = 100             # Safety limit